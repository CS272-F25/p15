// Prefill name + email from localStorage when the page loads
document.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("userName");
  const savedEmail = localStorage.getItem("userEmail");

  if (savedName) {
    document.getElementById("name").value = savedName;
  }
  if (savedEmail) {
    document.getElementById("email").value = savedEmail;
  }
});

// Handle form submission
document.getElementById("testDriveForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const vehicle = document.getElementById("vehicle").value.trim();
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  // Save name + email so the form is prefilled next time
  localStorage.setItem("userName", name);
  localStorage.setItem("userEmail", email);

  // Show confirmation message
  const confirmationBox = document.getElementById("confirmation");
  confirmationBox.textContent =
    `Thank you, ${name}! Your request to test drive "${vehicle}" on ${date} at ${time} has been received. We will contact you at ${email} to confirm.`;
  confirmationBox.classList.remove("d-none");

  // Optionally clear just the vehicle, date, and time fields
  document.getElementById("vehicle").value = "";
  document.getElementById("date").value = "";
  document.getElementById("time").value = "";
});
