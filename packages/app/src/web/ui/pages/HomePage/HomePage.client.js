/* eslint-disable */
(function () {
  "use strict";

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
      function updatePlaceholder() {
        searchInput.placeholder = mobileQuery.matches
          ? "owner/repo"
          : "github.com/owner/repo";
      }
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
        window.location.href = `/${parsed.owner}/${parsed.repo}`;
      });
    });
  }
})();
