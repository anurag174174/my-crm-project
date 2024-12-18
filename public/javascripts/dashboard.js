const menuButton = document.getElementById("menuButton");
    const menuDropdown = document.getElementById("menuDropdown");
    const profileButton = document.getElementById("profileButton");
    const profileSidebar = document.getElementById("profileSidebar");

    // Open/Close Dropdown Menu
    menuButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent event from bubbling to the document
        menuDropdown.classList.toggle("hidden");
    });

    // Open/Close Profile Sidebar
    profileButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent event from bubbling to the document
        profileSidebar.classList.toggle("translate-x-full");
    });

    // Close menus when clicking outside
    document.addEventListener("click", () => {
        // Close dropdown menu
        menuDropdown.classList.add("hidden");

        // Close profile sidebar
        profileSidebar.classList.add("translate-x-full");
    });

    // Prevent click on dropdown/sidebar from triggering document click
menuDropdown.addEventListener("click", (e) => e.stopPropagation());
profileSidebar.addEventListener("click", (e) => e.stopPropagation());


