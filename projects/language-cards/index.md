---
layout: page
title: "Language Cards"
---

<style>
  .project-shell {
    display: grid;
    gap: 20px;
  }

  .project-panel {
    border: 1px solid #e5e5e5;
    padding: 18px;
    background: #fff;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #999;
  }

  .status-dot.online {
    background: #1f8f4d;
  }

  .status-dot.offline {
    background: #b3261e;
  }

  .status-label {
    color: #555;
  }

  .muted {
    color: #666;
  }
</style>

<div class="project-shell">
  <section>
    <p>
      Language Cards will be a personal spaced-review system for storing expressions,
      translations, examples, review history, and learning analytics.
    </p>
    <p class="muted">
      The first public placeholder is live while the actual app is being built.
    </p>
  </section>

  <section class="project-panel">
    <h2>Platform Status</h2>
    <div class="status-row">
      <span id="platform-status-dot" class="status-dot"></span>
      <span id="platform-status-label" class="status-label">Checking backend...</span>
    </div>
    <p id="platform-status-detail" class="muted"></p>
  </section>
</div>

<script>
  (function () {
    var apiBase = "https://personal-backend-production-0d2e.up.railway.app";
    var dot = document.getElementById("platform-status-dot");
    var label = document.getElementById("platform-status-label");
    var detail = document.getElementById("platform-status-detail");

    fetch(apiBase + "/api/platform/status")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Unexpected response");
        }
        return response.json();
      })
      .then(function (data) {
        dot.classList.add("online");
        label.textContent = "Backend online";
        detail.textContent = data.name + " is running in " + data.environment + ".";
      })
      .catch(function () {
        dot.classList.add("offline");
        label.textContent = "Backend unavailable";
        detail.textContent = "The static page is online, but the backend check did not complete.";
      });
  })();
</script>
