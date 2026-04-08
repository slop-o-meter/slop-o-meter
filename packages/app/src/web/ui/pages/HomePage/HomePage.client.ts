function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  const stripped = input
    .replace(/^(https?:\/\/)?github\.com\//, "")
    .replace(/\/+$/, "");
  const parts = stripped.split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

const searchForm =
  document.querySelector<HTMLFormElement>("[data-search-form]");
if (searchForm) {
  const searchInput =
    searchForm.querySelector<HTMLInputElement>("input[name=query]");
  if (searchInput) {
    const mobileQuery = window.matchMedia("(max-width: 600px)");
    const updatePlaceholder = () => {
      searchInput.placeholder = mobileQuery.matches
        ? "owner/repo"
        : "github.com/owner/repo";
    };
    updatePlaceholder();
    mobileQuery.addEventListener("change", updatePlaceholder);
  }
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const input =
      searchForm.querySelector<HTMLInputElement>("input[name=query]");
    const value = input ? input.value.trim() : "";
    const parsed = parseOwnerRepo(value);
    if (!parsed) {
      return;
    }
    const button = searchForm.querySelector<HTMLButtonElement>(
      "button[type=submit]",
    );
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
    }).then(() => {
      if (input) {
        input.value = "";
      }
      window.location.href = "/" + parsed.owner + "/" + parsed.repo;
    });
  });
}

// --- Project card flip cycling ---

const grid = document.querySelector<HTMLElement>("[data-project-grid]");
if (grid) {
  const templates = document.querySelectorAll<HTMLTemplateElement>(
    "[data-project-template]",
  );

  if (templates.length > 0) {
    const templatesByIndex: Record<string, HTMLTemplateElement> = {};
    for (const template of templates) {
      const index = template.getAttribute("data-project-template")!;
      templatesByIndex[index] = template;
    }

    const flipInners = grid.querySelectorAll<HTMLElement>("[data-flip-inner]");

    if (flipInners.length > 0) {
      const slotCount = flipInners.length;
      const totalProjects = templates.length;

      const slotCurrentProject: number[] = [];
      const slotIsFlipped: boolean[] = [];
      const slotQueues: number[][] = [];
      const slotQueuePosition: number[] = [];

      for (let s = 0; s < slotCount; s++) {
        slotCurrentProject[s] = s;
        slotIsFlipped[s] = false;
        slotQueuePosition[s] = 0;

        const queue: number[] = [];
        for (let p = s; p < totalProjects; p += slotCount) {
          queue.push(p);
        }
        slotQueues.push(queue);
      }

      function populateCardFace(
        faceElement: HTMLElement,
        projectIndex: number,
      ) {
        const template = templatesByIndex[String(projectIndex)];
        if (!template) {
          return;
        }
        faceElement.innerHTML = "";
        const content = template.content.cloneNode(true);
        faceElement.appendChild(content);
      }

      function flipSlot(slotIndex: number) {
        const queue = slotQueues[slotIndex]!;
        if (queue.length <= 1) {
          return;
        }

        slotQueuePosition[slotIndex] =
          (slotQueuePosition[slotIndex]! + 1) % queue.length;
        const newProjectIndex = queue[slotQueuePosition[slotIndex]!]!;

        const flipInner = flipInners[slotIndex]!;
        const front = flipInner.children[0] as HTMLElement;
        const back = flipInner.children[1] as HTMLElement;

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

      for (let s = 0; s < slotCount; s++) {
        const slotIndex = s;
        const initialDelay = 3000 + Math.random() * 4000;
        setTimeout(() => {
          flipSlot(slotIndex);
          setInterval(() => {
            flipSlot(slotIndex);
          }, 10000);
        }, initialDelay);
      }
    }
  }
}
