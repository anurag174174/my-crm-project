const profileIcon = document.querySelector('.profile-icon'); 
const profilePopup = document.querySelector('.profile-popup');
const documentBody = document.body;
const logoutButton = document.querySelector('.logout');
const addLeadButton=document.querySelector('.add-lead')

profileIcon.addEventListener('click', () => {
    profilePopup.style.display = profilePopup.style.display === 'none' ? 'block' : 'none';
});

documentBody.addEventListener('click', (event) => {
    if (!profileIcon.contains(event.target) && !profilePopup.contains(event.target)) {
      profilePopup.style.display = 'none';
    }
});





