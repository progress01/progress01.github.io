// source/lib/calendar.js
var Calendar = Calendar || {};

Calendar.init = function(container, options) {
    var chart = echarts.init(document.getElementById(container));
    var data = options.data || {};
    var range = Object.keys(data).sort();
    
    // 如果沒有數據，預設顯示今年
    var currentYear = new Date().getFullYear();
    var start = range.length > 0 ? range[0] : currentYear + '-01-01';
    var end = range.length > 0 ? range[range.length - 1] : currentYear + '-12-31';
    var year = new Date(end).getFullYear();

    // 處理數據格式
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
            max: 5, // 顏色深淺的閥值
            calculable: false,
            orient: 'horizontal',
            left: 'center',
            top: 'top',
            inRange: { color: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'] } // GitHub 綠色風格
        },
        calendar: {
            top: 60,
            left: 30,
            right: 30,
            cellSize: ['auto', 13],
            range: year, // 只顯示最後一年
            itemStyle: { borderWidth: 0.5 },
            yearLabel: { show: true }
        },
        series: [{
            type: 'heatmap',
            coordinateSystem: 'calendar',
            data: heatmapData
        }]
    };

    chart.setOption(option);
    
    // RWD 自適應
    window.onresize = function() {
        chart.resize();
    };
};