document.lastScrollPosition = 0;
document.lastCentered = 0;
document.onWayTo = null;

document.addEventListener("scroll", () =>{
    const  direction = window.pageYOffset - document.lastScrollPosition > 0 ? 'down' : 'up';
    const sections = [...document.querySelectorAll('section')];

    if(document.onWayTo === null){

    const destinationIndex = direction === 'up' ? 
    document.lastCentered-1 : document.lastCentered+1;
    if(destinationIndex >= 0 && destinationIndex<sections.length){
        document.onWayTo = destinationIndex; 
        window.scroll(0, sections[destinationIndex].offsetTop);
    }


    }

    sections.forEach((section,index ) =>{
        if(window.pageYOffset === section.offsetTop){
            document.lastCentered = index;
            section.className = 'apply'
            if(document.onWayTo === index){
                document.onWayTo = null;
            }
        } else{
            section.className = '';
        }
    })
    document.lastScrollPosition = window.pageYOffset;

})