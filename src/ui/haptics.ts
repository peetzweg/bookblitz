/** A light tap from the phone's vibration motor, where the browser lets a page have one. */
export function haptic() {
  // Android (and anything else with the Vibration API).
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(6);
    return;
  }
  // iOS Safari has no Vibration API, but since iOS 18 toggling a switch control ticks the Taptic Engine,
  // even one that isn't on screen.
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.append(input);
  document.head.append(label);
  label.click();
  label.remove();
}
