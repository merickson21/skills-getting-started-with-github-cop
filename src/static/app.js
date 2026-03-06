document.addEventListener('DOMContentLoaded', () => {
  const activitiesList = document.getElementById('activities-list');
  const activitySelect = document.getElementById('activity');
  const signupForm = document.getElementById('signup-form');
  const messageDiv = document.getElementById('message');

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showMessage(text, type = 'info') {
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    messageDiv.classList.remove('hidden');
    setTimeout(() => messageDiv.classList.add('hidden'), 5000);
  }

  function clearGeneratedOptions() {
    const generated = activitySelect.querySelectorAll('option[data-generated]');
    generated.forEach(o => o.remove());
  }

  function renderActivities(activities) {
    activitiesList.innerHTML = '';
    clearGeneratedOptions();

    Object.entries(activities).forEach(([name, details]) => {
      const card = document.createElement('div');
      card.className = 'activity-card';
      card.setAttribute('data-activity', name);

      const spotsLeft = (details.max_participants || 0) - (details.participants ? details.participants.length : 0);

      // Participants markup with delete buttons
      let participantsHtml = '';
      if (Array.isArray(details.participants) && details.participants.length > 0) {
        participantsHtml = `
          <div class="participants">
            <div class="participants-title">Participants (${details.participants.length})</div>
            <ul class="participants-list">
              ${details.participants.map(p => `<li class="participant-item"><span class="participant-email">${escapeHtml(p)}</span><button class="participant-delete" data-email="${escapeHtml(p)}" aria-label="Remove ${escapeHtml(p)}">×</button></li>`).join('')}
            </ul>
          </div>`;
      } else {
        participantsHtml = `
          <div class="participants">
            <div class="participants-title">Participants (0)</div>
            <div class="no-participants">No participants yet</div>
          </div>`;
      }

      card.innerHTML = `
        <h4>${escapeHtml(name)}</h4>
        <p>${escapeHtml(details.description || '')}</p>
        <p><strong>Schedule:</strong> ${escapeHtml(details.schedule || '')}</p>
        <p><strong>Availability:</strong> ${escapeHtml(String(spotsLeft))} spots left</p>
        ${participantsHtml}
      `;

      activitiesList.appendChild(card);

      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      opt.setAttribute('data-generated', '1');
      activitySelect.appendChild(opt);
    });
  }

  async function fetchActivities() {
    try {
      const res = await fetch('/activities');
      if (!res.ok) throw new Error('Failed to load activities');
      const data = await res.json();
      renderActivities(data);
    } catch (err) {
      activitiesList.innerHTML = '<p class="error">Unable to load activities</p>';
      console.error('Error fetching activities:', err);
    }
  }

  // Delegate participant delete clicks
  activitiesList.addEventListener('click', async (ev) => {
    const btn = ev.target.closest && ev.target.closest('.participant-delete');
    if (!btn) return;

    const email = btn.getAttribute('data-email');
    const li = btn.closest('.participant-item');
    const card = btn.closest('.activity-card');
    const activity = card && card.getAttribute('data-activity');

    if (!activity || !email) return;

    if (!confirm(`Remove ${email} from ${activity}?`)) return;

    btn.disabled = true;
    try {
      const url = `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        showMessage(body.message || `Removed ${email}`, 'success');

        // Remove list item and update count/title
        if (li) li.remove();
        const title = card.querySelector('.participants-title');
        const ul = card.querySelector('.participants-list');
        if (title) {
          const currentMatch = title.textContent.match(/\((\d+)\)/);
          const newCount = currentMatch ? Math.max(0, Number(currentMatch[1]) - 1) : (ul ? ul.children.length : 0);
          title.textContent = `Participants (${newCount})`;
        }
        if (ul && ul.children.length === 0) {
          const participantsDiv = card.querySelector('.participants');
          if (participantsDiv) {
            participantsDiv.innerHTML = `
              <div class="participants-title">Participants (0)</div>
              <div class="no-participants">No participants yet</div>
            `;
          }
        }
      } else {
        const err = await res.json().catch(() => null);
        const detail = err && err.detail ? err.detail : res.statusText;
        showMessage(`Error: ${detail}`, 'error');
        btn.disabled = false;
      }
    } catch (err) {
      showMessage(`Network error: ${err.message}`, 'error');
      btn.disabled = false;
    }
  });

  signupForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = document.getElementById('email').value.trim();
    const activity = document.getElementById('activity').value;

    if (!email || !activity) {
      showMessage('Please provide an email and choose an activity.', 'error');
      return;
    }

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const url = `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`;
      const res = await fetch(url, { method: 'POST' });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        showMessage(body.message || `Signed up ${email} for ${activity}`, 'success');

        // Update participants list in-place
        const selector = `[data-activity="${CSS && CSS.escape ? CSS.escape(activity) : activity}"]`;
        const card = document.querySelector(selector);
        if (card) {
          const ul = card.querySelector('.participants-list');
          const title = card.querySelector('.participants-title');
          if (ul) {
            const li = document.createElement('li');
            li.className = 'participant-item';
            li.innerHTML = `<span class="participant-email">${escapeHtml(email)}</span><button class="participant-delete" data-email="${escapeHtml(email)}" aria-label="Remove ${escapeHtml(email)}">×</button>`;
            ul.appendChild(li);
            const match = title.textContent.match(/\((\d+)\)/);
            const count = match ? Number(match[1]) + 1 : ul.children.length;
            title.textContent = `Participants (${count})`;
          } else {
            const participantsDiv = card.querySelector('.participants');
            if (participantsDiv) {
              participantsDiv.innerHTML = `
                <div class="participants-title">Participants (1)</div>
                <ul class="participants-list"><li class="participant-item"><span class="participant-email">${escapeHtml(email)}</span><button class="participant-delete" data-email="${escapeHtml(email)}" aria-label="Remove ${escapeHtml(email)}">×</button></li></ul>
              `;
            }
          }
        }

        signupForm.reset();
      } else {
        const err = await res.json().catch(() => null);
        const detail = err && err.detail ? err.detail : res.statusText;
        showMessage(`Error: ${detail}`, 'error');
      }
    } catch (err) {
      showMessage(`Network error: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  fetchActivities();
});