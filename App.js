let openMenu = () => {
    document.querySelector('.backdrop').className = 'backdrop apply';
    document.querySelector('aside').className = 'apply';

}
const button = document.getElementById('menuBtn');

button.addEventListener('click',(e)=>{
    e.preventDefault();
    openMenu();
})
let closeMenu = () => {
    document.querySelector('.backdrop').className = 'backdrop';
    document.querySelector('aside').className = '';
    
}
const closebutton = document.querySelector('aside button.close');

closebutton.addEventListener('click',(e)=>{
    // e.preventDefault();
    closeMenu();
})
const closebutton2 = document.querySelector('.backdrop');
closebutton2.addEventListener('click',(e)=>{
    // e.preventDefault();
    closeMenu();
})
// //scrolling effect

// const lastScrollPosition = 0;
// const lastCentered = 0;
// //adding Event
// document.addEventListener('scroll', () =>{
// const direction = window.pageYOffset - lastScrollPosition > 0 'down' : 'up';
// const sections = [...document.querySelectorAll('section')];
// const destinationIndex = direction === 'up' ? lastCentered - 1 : lastCentered + 1;
// if(destinationIndex >= 0 && destinationIndex < sections.length){
//     console.log({destinationIndex,direction})
//     window.scroll(0,sections[destinationIndex].offsetTop);
// }
//     sections.forEach((sections , index))
//     if(window.pageYOffset === sections.offsetTop){
//         lastCentered = index;
//     }
//         lastScrollPosition = window.pageYOffset;
// })

