
shoonya_api = window.shoonya_api || {};

shoonya_api = function () {

    let ws = new WebSocket("wss://shoonya.finvasia.com/NorenWSWeb/");
    let vix_tk = '26017', nifty_tk = '26000', bank_nifty_tk = '26009'
    let def_tokens = ["NSE|26017", "NSE|26000", "NSE|26009"]
    let user = '', session_token=''

    function connect(uid, session_id) {
        user = uid
        session_token = session_id
        ws.onopen = function (event) {
            let data = {
                "t": "c",
                "uid": user,
                "actid": user,
                "susertoken": session_token,
                "source": "WEB"
            };
            console.log("Socket opened")
            ws.send(JSON.stringify(data));
            $('#connection_status').css('color', 'green')
            console.log("Session data sent")
        };

        ws.onmessage = function (event) {
            res = JSON.parse(event.data)
            // console.log(res)
            if ('s' in res) {
                if (res.s == 'OK') {
                    console.log('Login successful')
                    subscribe_tokens(def_tokens)
                }
            } else if ('lp' in res) {
                // console.log(res.tk + " " + res.lp)
                switch (res.tk) {
                    case vix_tk:
                        $('#vix').html(res.lp)
                        break;
                    case nifty_tk:
                        $('#nifty').html(res.lp)
                        break;
                    case bank_nifty_tk:
                        $('#bank_nifty').html(res.lp)
                        break;
                    default:
                        console.log('Default')
                        break;
                }
            }
        };

        ws.onclose = function (event) {
            $('#connection_status').css('color', 'red')
            console.log('WebSocket is closed. Reconnect will be attempted in 1 second.', event.reason);
            setTimeout(function() {
                connect();
            }, 1000);
        };

        ws.onerror = function (event) {
            console.error("WebSocket error: ", event);
        };
    }

    function subscribe_tokens(tokens) {
        let symtokens = {"t":"t","k": tokens.join('#').concat('#')}
        console.log(symtokens)
        ws.send(JSON.stringify(symtokens));
    }

    search_instrument = function(stext) {
        jKey = session_token
        params = {"uid": user, "stext": stext}
        let payload = 'jData=' + JSON.stringify(params);
        payload = payload + "&jKey=" + jKey;
        $(document).ready(function () {
            $.ajax({
                url: "https://shoonya.finvasia.com/NorenWClientWeb/SearchScrip",
                type: "POST",
                dataType: "json",
                data: payload,
                success: function (data, textStatus, jqXHR) {
                    console.log("Ajax success")
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Ajax error")
                }
            });
        });
    }

    return {
        "search_instrument" :  search_instrument,
        "connect" : connect
    }

}();


shoonya_api.connect("FA90807", "2d364dead2f36cef8521ba93fcaa19e067da46fd30c287cb92576a27f538003c");

$(document).ready(function() {
    $("#instr1").keyup(function() {
        $.ajax({
            type: "POST",
            url: "readCountry.php",
            data: 'keyword=' + $(this).val(),
            beforeSend: function() {
                $("#search-box").css("background", "#FFF url(LoaderIcon.gif) no-repeat 165px");
            },
            success: function(data) {
                $("#suggesstion-box").show();
                $("#suggesstion-box").html(data);
                $("#search-box").css("background", "#FFF");
            }
        });
    });
});
//To select a country name
function selectCountry(val) {
    $("#search-box").val(val);
    $("#suggesstion-box").hide();
}
