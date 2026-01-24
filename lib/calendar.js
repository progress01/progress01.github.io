// source/lib/calendar.js
var Calendar = Calendar || {};

Calendar.init = function(container, options) {
    var dom = document.getElementById(container);
    var chart = echarts.init(dom);
    var data = options.data || {};
    var range = Object.keys(data).sort();
    
    var currentYear = new Date().getFullYear();
    var start = range.length > 0 ? range[0] : currentYear + '-01-01';
    var end = range.length > 0 ? range[range.length - 1] : currentYear + '-12-31';
    var year = new Date(end).getFullYear();

    // 📱 RWD 核心邏輯：檢測螢幕寬度
    var screenWidth = window.innerWidth;
    var isMobile = screenWidth < 768; // 判斷是否為手機/平板
    
    // 手機版參數調整
    var cellSize = isMobile ? 10 : 13;       // 手機格子縮小到 10px
    var fontSize = isMobile ? 10 : 12;       // 字體縮小
    var itemBorder = isMobile ? 0 : 0.5;     // 手機版拿掉邊框讓視覺比較不擠
    var calendarLeft = isMobile ? 5 : 30;    // 左邊距縮小
    var calendarRight = isMobile ? 5 : 30;   // 右邊距縮小
    var titleTop = isMobile ? 10 : 60;       // 熱力圖位置

    // 如果是手機，強制設定容器寬度大於螢幕，觸發滑動效果 (700px 剛好夠放一年)
    if (isMobile) {
        dom.style.width = '700px'; 
        chart.resize(); // 重新計算大小
    }

    var heatmapData = [];
    for (var date in data) {
        heatmapData.push([date, data[date]]);
    }

    var option = {
        tooltip: {
            position: 'top',
            formatter: function (p) {
                var format = echarts.format.formatTime('yyyy-MM-dd', p.data[0]);
                return format + ': ' + p.data[1] + ' 篇文章';
            }
        },
        visualMap: {
            min: 0,
            max: 5,
            calculable: !isMobile, // 手機版隱藏調節棒，節省空間
            orient: 'horizontal',
            left: 'center',
            top: 0, // 放在最上面
            itemWidth: isMobile ? 10 : 20, // 調整圖例大小
            itemHeight: isMobile ? 10 : 140,
            inRange: { color: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'] }
        },
        calendar: {
            top: titleTop + 20,
            left: calendarLeft,
            right: calendarRight,
            cellSize: ['auto', cellSize], // RWD 格子大小
            range: year,
            itemStyle: { borderWidth: itemBorder },
            yearLabel: { show: !isMobile }, // 手機版隱藏年份標籤(因為太擠)
            dayLabel: { 
                margin: 5,
                fontSize: fontSize,
                nameMap: isMobile ? 'cn' : 'cn' // 可以改成 'en' 用英文縮寫更短
            },
            monthLabel: {
                margin: 5,
                fontSize: fontSize,
                nameMap: 'cn'
            }
        },
        series: [{
            type: 'heatmap',
            coordinateSystem: 'calendar',
            data: heatmapData
        }]
    };

    chart.setOption(option);
};