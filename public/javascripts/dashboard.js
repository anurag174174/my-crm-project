const menuButton = document.getElementById('menuButton');
const container = document.getElementById('container');
const sidebar = document.getElementById('sidebar');
const profileImage = document.getElementById('profileImage');
const popUp = document.getElementById('popUp');
const closeButton = document.getElementById('closeButton');
    
menuButton.addEventListener('click', () => {
sidebar.classList.toggle('-translate-x-full'); 
});

container.addEventListener('click', (event) => {
  if (!sidebar.contains(event.target) && !menuButton.contains(event.target)) {
      sidebar.classList.add('-translate-x-full'); 
  }
});
profileImage.addEventListener('click', () => {
  popUp.classList.remove('hidden'); // Makes the pop-up visible
});

closeButton.addEventListener('click', () => {
  popUp.classList.add('hidden'); // Hides the pop-up
});


