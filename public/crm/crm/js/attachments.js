(function exposeAttachmentUi(root) {
  function showDeleteConfirmation(fileName) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className =
        "fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4";

      const dialog = document.createElement("div");
      dialog.className = "w-full max-w-md rounded-xl bg-white p-6 shadow-2xl";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");

      const message = document.createElement("p");
      message.className = "text-gray-800 font-medium break-words";
      message.textContent = `Удалить файл «${fileName || "Файл"}»?`;

      const actions = document.createElement("div");
      actions.className = "mt-6 flex justify-end gap-3";
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className =
        "rounded-lg border border-gray-300 px-4 py-2 font-bold text-gray-700 hover:bg-gray-50";
      cancelButton.textContent = "Отмена";
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className =
        "rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700";
      deleteButton.textContent = "Удалить";

      const finish = (answer) => {
        overlay.remove();
        resolve(answer);
      };
      cancelButton.addEventListener("click", () => finish(false));
      deleteButton.addEventListener("click", () => finish(true));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) finish(false);
      });

      actions.append(cancelButton, deleteButton);
      dialog.append(message, actions);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      cancelButton.focus();
    });
  }

  function bindDeleteButton(button, options) {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const confirmed = await options.confirmDelete(options.fileName);
      if (!confirmed) return;
      button.disabled = true;
      try {
        await options.deleteAttachment();
        await options.refresh();
      } catch (error) {
        button.disabled = false;
        options.onError(error);
      }
    });
  }

  root.AttachmentUI = {
    showDeleteConfirmation,
    bindDeleteButton,
  };
})(globalThis);
