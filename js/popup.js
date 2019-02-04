    function openWindow(obj){
        var qq_or_weixin = "light_qq";
        switch(obj.id)
        {
            case 'contact_weixin':
            qq_or_weixin = "light_weixin";
            break;

            case 'contact_qq':
            qq_or_weixin = "light_qq";
            break;
        }
        document.getElementById(qq_or_weixin).style.display='block';
        document.getElementById('fade').style.display='block';
    }
    function closeWindow(){
        document.getElementById('light_weixin').style.display='none';
        document.getElementById('light_qq').style.display='none';
        document.getElementById('fade').style.display='none';
    }
