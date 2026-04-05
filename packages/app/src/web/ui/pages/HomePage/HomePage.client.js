/* eslint-disable */
(function () {
  "use strict";

  // --- Search form logic ---

  function parseOwnerRepo(input) {
    var stripped = input
      .replace(/^(https?:\/\/)?github\.com\//, "")
      .replace(/\/+$/, "");
    var parts = stripped.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  }

  var searchForm = document.querySelector("[data-search-form]");
  if (searchForm) {
    var searchInput = searchForm.querySelector("input[name=query]");
    if (searchInput) {
      var mobileQuery = window.matchMedia("(max-width: 600px)");
      var updatePlaceholder = function () {
        searchInput.placeholder = mobileQuery.matches
          ? "owner/repo"
          : "github.com/owner/repo";
      };
      updatePlaceholder();
      mobileQuery.addEventListener("change", updatePlaceholder);
    }
    searchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = searchForm.querySelector("input[name=query]");
      var value = input ? input.value.trim() : "";
      var parsed = parseOwnerRepo(value);
      if (!parsed) {
        return;
      }
      var button = searchForm.querySelector("button[type=submit]");
      searchForm.style.opacity = "0.5";
      searchForm.style.pointerEvents = "none";
      if (input) {
        input.disabled = true;
      }
      if (button) {
        button.disabled = true;
        button.textContent = "Measuring\u2026";
      }
      fetch("/api/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: parsed.owner,
          repo: parsed.repo,
        }),
      }).then(function () {
        if (input) {
          input.value = "";
        }
        window.location.href = "/" + parsed.owner + "/" + parsed.repo;
      });
    });
  }

  // --- Project card flip cycling ---

  var grid = document.querySelector("[data-project-grid]");
  if (!grid) {
    return;
  }

  var templates = document.querySelectorAll("[data-project-template]");
  if (templates.length === 0) {
    return;
  }

  // Collect all template contents indexed by their project number
  var templatesByIndex = {};
  for (var i = 0; i < templates.length; i++) {
    var index = templates[i].getAttribute("data-project-template");
    templatesByIndex[index] = templates[i];
  }

  var flipInners = grid.querySelectorAll("[data-flip-inner]");
  if (flipInners.length === 0) {
    return;
  }

  var slotCount = flipInners.length;
  var totalProjects = templates.length;

  // Track which project index each slot is currently showing
  var slotCurrentProject = [];
  for (var s = 0; s < slotCount; s++) {
    slotCurrentProject[s] = s;
  }

  // Track flip state per slot (false = showing front, true = showing back)
  var slotIsFlipped = [];
  for (var s = 0; s < slotCount; s++) {
    slotIsFlipped[s] = false;
  }

  // Each slot cycles sequentially through projects in a fixed order.
  // Build per-slot queues: slot 0 gets projects 0, 3, 6, 9, ...; slot 1 gets 1, 4, 7, ...; etc.
  var slotQueues = [];
  for (var s = 0; s < slotCount; s++) {
    var queue = [];
    for (var p = s; p < totalProjects; p += slotCount) {
      queue.push(p);
    }
    slotQueues.push(queue);
  }

  // Track position within each slot's queue (starts at 0 = the initially rendered project)
  var slotQueuePosition = [];
  for (var s = 0; s < slotCount; s++) {
    slotQueuePosition[s] = 0;
  }

  function populateCardFace(faceElement, projectIndex) {
    var template = templatesByIndex[String(projectIndex)];
    if (!template) {
      return;
    }
    faceElement.innerHTML = "";
    var content = template.content.cloneNode(true);
    faceElement.appendChild(content);
  }

  function flipSlot(slotIndex) {
    var queue = slotQueues[slotIndex];
    if (queue.length <= 1) {
      return;
    }

    slotQueuePosition[slotIndex] =
      (slotQueuePosition[slotIndex] + 1) % queue.length;
    var newProjectIndex = queue[slotQueuePosition[slotIndex]];

    var flipInner = flipInners[slotIndex];
    var front = flipInner.children[0];
    var back = flipInner.children[1];

    if (!slotIsFlipped[slotIndex]) {
      populateCardFace(back, newProjectIndex);
      flipInner.classList.add("flipped");
    } else {
      populateCardFace(front, newProjectIndex);
      flipInner.classList.remove("flipped");
    }

    slotIsFlipped[slotIndex] = !slotIsFlipped[slotIndex];
    slotCurrentProject[slotIndex] = newProjectIndex;
  }

  // Each slot runs its own interval, but starts with a random initial delay
  for (var s = 0; s < slotCount; s++) {
    (function (slotIndex) {
      var initialDelay = 3000 + Math.random() * 4000;
      setTimeout(function () {
        flipSlot(slotIndex);
        setInterval(function () {
          flipSlot(slotIndex);
        }, 10000);
      }, initialDelay);
    })(s);
  }
})();
