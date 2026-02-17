conf = window.conf || {};
conf = {
    broker : {
        shoonya: {
            user_id: "",
            session_token: "",
        },
        kite : {
            user_id : "",
            session_token : "",
        }
    },

    bank_nifty: {
        round_to: 100,
        lot_size : 15,
        max_order_qty: 900,
    },
    nifty : {
        round_to: 50,
        lot_size : 75,
        max_order_qty: 1800,
    },
    fin_nifty : {
        round_to: 50,
        lot_size : 25,
        max_order_qty: 1800,
    },
    midcap_nifty : {
        round_to: 25,
        lot_size : 75,
        max_order_qty: 4200,
    },
    sensex : {
        round_to: 100,
        lot_size : 25,
        max_order_qty: 500,
    },
    bankex : {
        round_to: 100,
        lot_size : 15,
        max_order_qty: 600,
    },

    spreads : {
        instrument : "bank_nifty",  // Default instrument..  nifty, bank_nifty, fin_nifty are the allowed values
        atm_strike_check_interval : 30000,
        strikes_after_before_atm : 5,   //Default value
    },

    straddle: {
        strategy: "long",
        atm_pct_diff: 10,   // Default atm_pct_diff
        profit : 1000,
        loss : -1000,
        lots : 1,       //Default number of lots
        monitor_interval: 1000,                     //Monitor if the prices match the percentage diff to start straddle
        atm_premium_monitor_interval : 30000,       //Check whether ATM premium is changed

        retry_count : 1,
        bank_nifty: {
            tolerate_deviation: 180,
        },
        nifty : {
            tolerate_deviation: 100,
        },
        fin_nifty : {
            tolerate_deviation: 100,
        }
    },

    strangle: {
        profit : 500,
        loss : -1000,
        monitor_interval: 1000,
        retry_count : 1,
        deploy_hedge : true,
        lots : 1,            //Default number of lots

        bank_nifty: {
            strangle_distance_points : 500,
            hedge_distance_points: 300,
        },
        nifty : {
            strangle_distance_points : 200,
            hedge_distance_points: 100,
        },
        fin_nifty : {
            strangle_distance_points : 200,
            hedge_distance_points: 100,
        },

        delay_SL : 60,          // In seconds.. Delay SL by these many seconds
    },

    alert_profit_threshold : 50, //Alert once the profit % exceeds the specified value
    alert_loss_threshold : 50, //Alert once the loss % exceeds the specified value
    target_sl_check_interval : 500, // In Milliseconds. Check for target and SL after every 500 ms
    heartbeat_timeout : 7000,
    alert_msg_disappear_after : 6000, // Unit milliseconds
    alert_error_disappear_after : 10000, // Unit milliseconds
}
