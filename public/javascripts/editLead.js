const navMenu = document.getElementById('navMenu');
const toggleNav = document.getElementById('toggleNav');
const closeNav = document.getElementById('closeNav');
const leadStatus = document.getElementById("leadStatus");
const contactDetails = document.getElementById("contactDetails");
// Toggle navigation on Menu button click
toggleNav.addEventListener('click', () => {
    navMenu.classList.toggle('-translate-x-full');
});

// Close navigation on Close button click
closeNav.addEventListener('click', () => {
    navMenu.classList.add('-translate-x-full');
});

// Close navigation if user clicks outside the menu
document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && !toggleNav.contains(e.target)) {
        navMenu.classList.add('-translate-x-full');
    }
});

leadStatus.addEventListener("change", function () {
    const selectedText = this.options[this.selectedIndex].text;
    if (selectedText === "won") {
        contactDetails.classList.remove("hidden");
    } else {
        contactDetails.classList.add("hidden");
    }
});