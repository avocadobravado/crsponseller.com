console.log('hi');

$(window).load(function(){
    $(window).resize(function(){
          var headerHeight = $('header.fixed').css('height');
          $('main.flspac').css('margin-top', headerHeight);
    });
    $(window).resize();
});
$(function() {
$('a[href*=#]:not([href=#])').click(function() {
  if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') 
&& location.hostname == this.hostname) {

    var target = $(this.hash);
    target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
    if (target.length) {
      $('html,body').animate({
        scrollTop: target.offset().top - 125 //offsets for fixed header
      }, 1000);
      return false;
    }
  }
});
//Executed on page load with URL containing an anchor tag.
if($(location.href.split("#")[1])) {
    var target = $('#'+location.href.split("#")[1]);
    
    if (target.length) {
      $('html,body').animate({
        scrollTop: target.offset().top - 400 //offset height of header here too.
      }, 1000);
      return false;
    }
  }
});