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

        var formattedTime = hours + ':' + minutes + ':' + seconds + ' ' + meridiem;
        document.getElementById('time').innerHTML = formattedTime;
    },
};