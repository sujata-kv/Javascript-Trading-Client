lib = window.lib || {}
lib = {
    updateClock: function () {
        var currentTime = new Date();
        var hours = currentTime.getHours();
        var minutes = currentTime.getMinutes();
        var seconds = currentTime.getSeconds();

        // Convert to 12-hour format
        var meridiem = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12; // If hours is 0, set it to 12

        // Add leading zero if minutes or seconds are less than 10
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;

        var formattedTime = hours + ':' + minutes + ':' + seconds;
        document.getElementById('time').innerHTML = formattedTime;
        document.getElementById('meridian').innerHTML = meridiem;
    },

    show_success_msg: function(message, disappear= true) {
        // Generate success alert div
        var successAlert = $('<div>').addClass('alert alert-success')
            .attr('id', 'order_success_alert')
            .html('<span id="order_success_msg">' + message + '</span>' +
                '<button type="button" class="close-btn" aria-label="Close" onclick="client_api.close_event_handler">' +
                '<span aria-hidden="true">&times;</span>' +
                '</button>');

        // Attach close button event handler
        successAlert.find('.close-btn').on('click', function(e) {
            e.preventDefault(); // Prevent default button behavior
            successAlert.remove(); // Remove the success alert div
        });

        // Append to alert_div
        $('#alert_div').append(successAlert);

        if(disappear) {
            setTimeout(function() {
                successAlert.remove();
            }, conf.alert_msg_disappear_after)
        }
    },

    show_error_msg: function(message, disappear=true) {
        // Generate error alert div
        var errorAlert = $('<div>').addClass('alert alert-danger')
            .attr('id', 'order_error_alert')
            .html('<span id="order_error_msg">' + message + '</span>' +
                '<button type="button" class="close-btn">' +
                '<span aria-hidden="true">&times;</span>' +
                '</button>');

        // Attach close button event handler
        errorAlert.find('.close-btn').on('click', function(e) {
            e.preventDefault(); // Prevent default button behavior
            errorAlert.remove(); // Remove the error alert div
        });

        // Append to alert_div
        $('#alert_div').append(errorAlert);

        if(disappear) {
            setTimeout(function() {
                errorAlert.remove();
            }, conf.alert_error_disappear_after)
        }
    }
};