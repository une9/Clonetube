# Clonetube

2021.02.07-2021.02.14

* **Youtube clone coding** for html/css/javascript practice
  - I tried to copy the design mainly based on Youtube mobile application but also refered to web page (they have quite different design details)
* **Responsive design** (mobile-first)
  - Remarkable difference: description box and comments box appears in different way
* Used **Youtube API** service to get information about videos
  - You can see the page made up of restrictive info uploaded on some demo files in the repository
  - You can fully experience the page with your own Youtube API key put in the javascript file and change 'DEMO' value to 'false'
* Some points I intended 😉✨
  - getting information through Youtube API and building html DOM dynamically
  - foldable items (description box, comments box, long comment exceeding 5 lines, replies)
  - window resize event handler
  - clickable items (channel img, channel title, related videos...)
  - dualized route to get information (DEMO version vs full version with API key)
  - used only vanilla javascript
     
     
* Some noticed errors but not fixed due to several reasons 😂 (I hope I can fix them someday)
  - The texts are blurred during slide-in animation of description box & comments box (using css animation)
  - The appearing & disappearing effects of description box & comments box were not coded in consistent way
  - It could not display the exact nickname mentioned in the reply 
  - The word-wrap does not work properly on some comments (I don't know the reason)
  - The line-heights of some comments are not consistent on some browsers (I don't know the reason)
  - Some letters were broken while fetching information through the Youtube API 
  - Some design details have to be fixed for the better look e.g. the thickness of the line of icons, the line-height of comment texts
  - slow display of first comment
  - incomplete semantic design of html
  
