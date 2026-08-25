// source/lib/calendar.js
var Calendar = Calendar || {};

Calendar.init = function(container, options) {
    options = options || {};

    var dom = document.getElementById(container);
    if (!dom || typeof echarts === 'undefined') return;

    var oldChart = echarts.getInstanceByDom ? echarts.getInstanceByDom(dom) : null;
    if (oldChart) oldChart.dispose();

    var chart = echarts.init(dom);
    var data = options.data || {};
    var dates = Object.keys(data).sort();
    var currentYear = new Date().getFullYear();
    var latestYear = dates.length > 0 ? dates[dates.length - 1].slice(0, 4) : String(currentYear);
    var year = String(options.year || latestYear);
    var heatmapData = [];
    var maxValue = 0;

    dates.forEach(function(date) {
        if (date.slice(0, 4) === year) {
            var value = Number(data[date]) || 0;
            heatmapData.push([date, value]);
            maxValue = Math.max(maxValue, value);
        }
    });

    // 📱 RWD 核心邏輯：手機保留一年完整寬度，交給外層容器水平滑動。
    var isMobile = window.innerWidth < 768;
    var cellSize = isMobile ? 10 : 13;
    var fontSize = isMobile ? 10 : 12;
    var itemBorder = isMobile ? 0 : 0.5;
    var calendarLeft = isMobile ? 5 : 30;
    var calendarRight = isMobile ? 5 : 30;
    var titleTop = isMobile ? 10 : 60;

    dom.style.width = isMobile ? '700px' : '100%';
    chart.resize();

    var option = {
        tooltip: {
            position: 'top',
            formatter: function(p) {
                var format = echarts.format.formatTime('yyyy-MM-dd', p.data[0]);
                return format + ': ' + p.data[1] + ' 篇文章';
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(1, maxValue),
            calculable: !isMobile,
            orient: 'horizontal',
            left: 'center',
            top: 0,
            itemWidth: isMobile ? 10 : 20,
            itemHeight: isMobile ? 10 : 140,
            inRange: { color: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'] }
        },
        calendar: {
            top: titleTop + 20,
            left: calendarLeft,
            right: calendarRight,
            cellSize: ['auto', cellSize],
            range: year,
            itemStyle: { borderWidth: itemBorder },
            yearLabel: { show: !isMobile },
            dayLabel: {
                margin: 5,
                fontSize: fontSize,
                nameMap: 'cn'
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
    return chart;
};
