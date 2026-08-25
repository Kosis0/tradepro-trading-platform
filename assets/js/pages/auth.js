(() => {
  "use strict";

  const T = window.TP;
  if (!T) return;

  const { $, $$ } = T;
  const page = document.body.dataset.page;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^[+\d][\d\s\-().]{6,}$/;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  function setError(input, msg) {
    const field = input.closest(".field");
    if (!field) return;
    field.classList.add("has-error");
    const err = field.querySelector(".field-error");
    if (err) err.textContent = msg;
    input.setAttribute("aria-invalid", "true");
  }

  function clearError(input) {
    const field = input.closest(".field");
    if (!field) return;
    field.classList.remove("has-error");
    const err = field.querySelector(".field-error");
    if (err) err.textContent = "";
    input.removeAttribute("aria-invalid");
  }

  function clearFormErrors(form) {
    form.querySelectorAll("input, select").forEach(clearError);
  }

  function showAlert(msg) {
    const el = $("#form-alert");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function hideAlert() {
    const el = $("#form-alert");
    if (el) el.hidden = true;
  }

  function maskEmail(email) {
    if (!email || !email.includes("@")) return "your inbox";
    const [local, domain] = email.split("@");
    const head = local.slice(0, Math.min(2, local.length));
    return `${head}\u2022\u2022\u2022@${domain}`;
  }

  $$(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.innerHTML = `<i class="fa-solid ${showing ? "fa-eye" : "fa-eye-slash"}"></i>`;
      btn.setAttribute("aria-pressed", String(!showing));
      btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    });
  });

  $$(".social-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      T.toast.info(`${btn.dataset.provider} sign-in isn't wired up in this demo.`, "Demo only");
    });
  });

  function scorePassword(v) {
    if (!v) return 0;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    if (v.length < 8) score = Math.min(score, 1);
    return Math.min(4, score);
  }

  const STRENGTH_LABELS = ["Strength", "Weak", "Fair", "Good", "Strong"];

  function bindStrengthMeter() {
    const password = $("#password");
    const box = $("#strength");
    const label = $("#strength-label");
    if (!password || !box || !label) return;
    password.addEventListener("input", () => {
      const level = scorePassword(password.value);
      box.dataset.level = String(level);
      label.textContent = STRENGTH_LABELS[level];
    });
  }

  function armResendCooldown(btn, storageKey) {
    const PERIOD_MS = 60000;
    const paint = () => {
      const until = Number(localStorage.getItem(storageKey) || 0);
      const left = Math.ceil((until - Date.now()) / 1000);
      if (left > 0) {
        btn.disabled = true;
        btn.textContent = `Resend available in ${left}s`;
        return true;
      }
      btn.disabled = false;
      btn.textContent = "Resend email";
      return false;
    };
    const interval = setInterval(paint, 1000);
    paint();
    btn.addEventListener("click", () => {
      localStorage.setItem(storageKey, String(Date.now() + PERIOD_MS));
      T.toast.info("If that address exists, a new link is on its way.", "Email sent");
      paint();
    });
    window.addEventListener("beforeunload", () => clearInterval(interval));
  }

  if (page === "login") {
    const fillBtn = $("#fill-demo");
    if (fillBtn) {
      fillBtn.addEventListener("click", () => {
        $("#email").value = "demo@tradepro.com";
        $("#password").value = "Demo1234!";
        clearError($("#email"));
        clearError($("#password"));
        T.toast.info("Demo credentials filled — hit Log in.", "Ready when you are");
        $("#login-submit").focus();
      });
    }

    const form = $("#login-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert();
        clearFormErrors(form);

        const emailInput = $("#email");
        const pwInput = $("#password");
        const remember = $("#remember").checked;
        let ok = true;

        if (!EMAIL_RE.test(emailInput.value.trim())) {
          setError(emailInput, "Enter a valid email address.");
          ok = false;
        }
        if (!pwInput.value) {
          setError(pwInput, "Enter your password.");
          ok = false;
        }
        if (!ok) return;

        const submit = $("#login-submit");
        T.btnLoading(submit, true);
        await delay(650);

        try {
          const user = await T.Auth.login(emailInput.value.trim(), pwInput.value, remember);
          T.toast.success(`Welcome back, ${user.first}.`, "Logged in");
          setTimeout(() => { window.location.href = "dashboard.html"; }, 650);
        } catch (err) {
          T.btnLoading(submit, false);
          if (err.code === "UNVERIFIED") {
            T.toast.warning("Please verify your email address first.", "Almost there");
            setTimeout(() => {
              window.location.href = `verify-email.html?email=${encodeURIComponent(err.email || emailInput.value.trim())}`;
            }, 900);
            return;
          }
          showAlert(err.message);
          T.toast.error(err.message);
        }
      });
    }
  }

  if (page === "register") {
    bindStrengthMeter();

    const form = $("#register-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert();
        clearFormErrors(form);

        const first = $("#first-name");
        const last = $("#last-name");
        const email = $("#email");
        const password = $("#password");
        const confirm = $("#confirm-password");
        const country = $("#country");
        const phone = $("#phone");
        const terms = $("#terms");
        let ok = true;

        if (first.value.trim().length < 2) { setError(first, "Please enter your first name."); ok = false; }
        if (last.value.trim().length < 2) { setError(last, "Please enter your last name."); ok = false; }
        if (!EMAIL_RE.test(email.value.trim())) { setError(email, "Enter a valid email address."); ok = false; }
        if (password.value.length < 8) { setError(password, "Password must be at least 8 characters."); ok = false; }
        else if (scorePassword(password.value) < 2) { setError(password, "Too weak — mix upper/lowercase letters, numbers or symbols."); ok = false; }
        if (confirm.value !== password.value || !confirm.value) { setError(confirm, "Passwords do not match."); ok = false; }
        if (!country.value) { setError(country, "Select your country."); ok = false; }
        if (phone.value.trim() && !PHONE_RE.test(phone.value.trim())) { setError(phone, "Enter a valid phone number."); ok = false; }
        if (!terms.checked) { setError(terms, "You must accept the terms to continue."); ok = false; }
        if (!ok) {
          const firstInvalid = form.querySelector('[aria-invalid="true"]');
          if (firstInvalid) firstInvalid.focus();
          return;
        }

        const submit = $("#register-submit");
        T.btnLoading(submit, true);
        await delay(800);

        try {
          const user = T.Auth.register({
            first: first.value,
            last: last.value,
            email: email.value.trim(),
            password: password.value,
            country: country.value,
            phone: phone.value.trim(),
            newsletter: $("#newsletter").checked
          });
          localStorage.setItem("tp_verify_email", user.email);
          T.toast.success("Account created! One last step…", "Check your inbox");
          setTimeout(() => {
            window.location.href = `verify-email.html?email=${encodeURIComponent(user.email)}`;
          }, 750);
        } catch (err) {
          T.btnLoading(submit, false);
          setError(email, err.message);
          showAlert(err.message);
        }
      });
    }
  }

  if (page === "forgot") {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("email");
    if (preset) $("#email").value = preset.slice(0, 120);

    const form = $("#reset-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormErrors(form);
      const emailInput = $("#email");
      if (!EMAIL_RE.test(emailInput.value.trim())) {
        setError(emailInput, "Enter a valid email address.");
        return;
      }

      const submit = $("#reset-submit");
      T.btnLoading(submit, true);
      await delay(900);

      const email = emailInput.value.trim();
      localStorage.setItem("tp_reset_email", email);
      localStorage.setItem("tp_reset_sent_at", String(Date.now()));
      $("#masked-email").textContent = maskEmail(email);
      $("#step-request").hidden = true;
      const sentStep = $("#step-sent");
      sentStep.hidden = false;
      armResendCooldown($("#resend-btn"), "tp_reset_sent_at");
      T.btnLoading(submit, false);
    });

    armResendCooldown($("#resend-btn"), "tp_reset_sent_at");

    $("#demo-reset").addEventListener("click", () => {
      const email = localStorage.getItem("tp_reset_email") || "";
      const user = email && T.Store.findUser(email);
      if (user) {
        T.Store.changePassword(email, "Demo1234!");
        T.toast.success(`Password reset to Demo1234! for ${maskEmail(email)}.`, "Done");
      } else {
        T.toast.warning("That account doesn't exist in this browser's demo data.", "Nothing to reset");
      }
    });
  }

  if (page === "verify") {
    const params = new URLSearchParams(window.location.search);
    const email = decodeURIComponent(params.get("email") || "").slice(0, 120);
    $("#masked-email").textContent = maskEmail(email);

    armResendCooldown($("#resend-btn"), "tp_verify_sent_at");

    $("#verify-now").addEventListener("click", () => {
      const target = email || localStorage.getItem("tp_verify_email") || "";
      const user = target && T.Store.findUser(target);
      if (!user) {
        T.toast.error("No pending account found. Please register again.", "Not found");
        return;
      }
      T.Store.markVerified(target);
      T.toast.success("Email verified — you can log in now.", "All set");
      setTimeout(() => { window.location.href = "login.html"; }, 900);
    });
  }
})();
