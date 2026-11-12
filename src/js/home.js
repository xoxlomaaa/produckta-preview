import {initSmoothScroll} from './smooth-scroll.js';
import {initPageMotion} from './page-motion.js';

initSmoothScroll();
initPageMotion();

const menu = document.querySelector(".mobile-menu");
const menuTrigger = document.querySelector(".mobile-menu-trigger");
if (menu && menuTrigger) {
  menuTrigger.hidden = false;
  menuTrigger.addEventListener("click", () => {
    if (menu.open) return;
    menu.showModal();
    document.documentElement.classList.add("menu-is-open");
    menuTrigger.setAttribute("aria-expanded", "true");
  });
  menu.querySelector(".mobile-menu-close").addEventListener("click", () => menu.close());
  menu.addEventListener("click", (event) => {
    const bounds = menu.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (event.target.closest("a") || (event.target === menu && outside)) menu.close();
  });
  menu.addEventListener("close", () => {
    document.documentElement.classList.remove("menu-is-open");
    menuTrigger.setAttribute("aria-expanded", "false");
  });

  // CSS owns the breakpoint; no duplicated numeric media query in JS.
  if ("ResizeObserver" in window) {
    const headerObserver = new ResizeObserver(() => {
      if (!menu.open || getComputedStyle(menuTrigger).display !== "none") return;
      menu.close();
      document.querySelector(".site-header .brand").focus({preventScroll: true});
    });
    headerObserver.observe(menuTrigger.parentElement);
  }
}

const form = document.querySelector("[data-preview-form]");
if (form) {
  const submit = form.querySelector("button[type=submit]");
  const status = form.querySelector("[data-form-status]");
  const phone = form.elements.namedItem("phone");
  const budgetOptions = form.querySelector(".request-options--budget");
  let selectedBudget = budgetOptions.querySelector("input:checked");

  function clearBudget(input) {
    input.checked = false;
    selectedBudget = null;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Radios are checked before click handlers run; keep the previous selection.
  budgetOptions.addEventListener("click", (event) => {
    const input = event.target;
    if (!input.matches("input[name=budget]")) return;
    if (selectedBudget === input) {
      clearBudget(input);
    } else {
      selectedBudget = input;
    }
  });
  budgetOptions.addEventListener("keydown", (event) => {
    const input = event.target;
    if (event.key !== " " || !input.matches("input[name=budget]")) return;
    if (event.repeat || input.checked) {
      event.preventDefault();
      if (!event.repeat) clearBudget(input);
    }
  });
  budgetOptions.addEventListener("change", () => {
    selectedBudget = budgetOptions.querySelector("input:checked");
  });
  form.addEventListener("reset", () => {
    selectedBudget = [...budgetOptions.querySelectorAll("input")].find(input => input.defaultChecked) ?? null;
  });

  function validateFields() {
    for (const name of ["name", "task"]) {
      const field = form.elements.namedItem(name);
      field.setCustomValidity(field.value && !field.value.trim() ? "Заполните поле, пожалуйста." : "");
    }
    const digits = phone.value.replace(/\D/g, "");
    const validPhone = /^[+\d\s().-]+$/.test(phone.value) && digits.length >= 10 && digits.length <= 15;
    phone.setCustomValidity(phone.value && !validPhone ? "Укажите телефон с кодом страны: от 10 до 15 цифр." : "");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    validateFields();
    if (!form.reportValidity()) return;
    status.textContent = "Всё заполнено. В предпросмотре заявка не отправляется — введённые данные остались в форме.";
  });
  form.addEventListener("invalid", () => {
    status.textContent = "Проверьте обязательные поля и согласие на обработку данных.";
  }, true);
  form.addEventListener("input", () => {
    validateFields();
    status.textContent = "";
  });
  submit.disabled = false;
}

const privacy = document.querySelector("#privacy-policy");
for (const opener of document.querySelectorAll("[data-policy-open]")) {
  opener.addEventListener("click", (event) => {
    if (privacy) event.preventDefault();
    if (privacy && !privacy.open) privacy.showModal();
  });
}

