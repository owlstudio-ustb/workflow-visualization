(function($) {

	var Stackedcolumnchart = function(renderTo, seriesNames, dataCopy, classesCopy) {

		var module = this,
			$div,
			$graph,
			graph,
			graphData = [],
			names = [],
			data = [];

		module.init = function(renderTo, seriesNames, dataCopy, classesCopy) {
			$div = renderTo;
			$div.data("dashboard.trivariate.stackedcolumnchart", module);
			names = seriesNames;
			data = dataCopy;
			classes = classesCopy;
			$graph = $div.find('.chart.image');

			module.reset();

			$div.html("<div class='ui " + numberToEnglish(data.length) + " column grid'></div>");
			data.forEach(function(singleData, ix) {
				$div.find(".grid").append($("<div>").addClass("block-" + ix).addClass("column"));
				module.render($div.find(".block-" + ix), singleData, classes[ix]);
			});
		};

		module.render = function(renderTo, data, classes) {
			if(data[0][0] == null || data[1][0] == null || data[2][0] == null) {
				renderTo.showNoData();
				return;
			}

			graphData = [];
			classes[2].forEach(function (item3, ix) {
				classes[1].forEach(function (item2) {
					graphData.push({
						name: item2,  
						data: classes[0].map(function (item1) {
							return data[0].filter(function (val, ix) {
								return (data[0][ix] == item1
								 && data[1][ix] == item2
								 && data[2][ix] == item3);
							}).length;
						}),
						showInLegend: ix == 0, 
						stack: item3,
						stackName: item3
					});
				});
			});

			graph = new Highcharts.Chart({
				chart: {
					renderTo: renderTo.get(0),
					type: 'column',
					style: {
						fontFamily: 'Lato'
					}
				},
				title: {
					text: ''
				},
				colors: (function () {
					var colors = [],
						base = '#3198f7',
						i,
						len = classes[1].length;

					for (i = 0; i < len; i += 1) {
						colors.push(Highcharts.Color(base).brighten((i - len / 2) / (len / 2 + 2)).get());
					}
					
					return colors;
				}()),
				xAxis: {
					categories: classes[0],
					title: {
						enabled: true,
						text: names[0]
					}
				},
				yAxis: {
					title: {
						text: 'Total ' + names[1]
					}
				},
				plotOptions: {
					column: {
						stacking: 'normal',
						events: {
							legendItemClick: function () {
								return false;
							}
						}
					}
				},
				series: graphData,
				tooltip: {
					formatter: function() {
						return names[0] + ': <b>' + this.point.x + '</b><br/>'
							+ names[2] + ': <b>' + this.series.stackKey.substr(6) + '</b><br/>'
							+ names[1] + ': <b>' + this.series.name + '</b><br/>'
							+ 'Count: <b>' + this.point.y + '</b> of ' + this.point.stackTotal;
					}
				},
				credits: {
				  enabled: false
				}
			});
		};

		module.reset = function() {
			// if init has not been run, do nothing
			if(!$div) return;

			$graph.html("");
		};

		module.init(renderTo, seriesNames, dataCopy, classesCopy);

	};

	$.fn.dashboard_trivariate_stackedcolumnchart = function () {
        var args = Array.prototype.slice.call(arguments);
        return this.each(function () {
        	if(typeof args[0] == "string") {
        		if($.data($(this), "dashboard.trivariate.stackedcolumnchart") !== undefined) {
        			$.data($(this), "dashboardtrivariate.stackedcolumnchart")[args[0]].apply(null, args.slice(1));
        		}
        	}
        	else {
        		(new (Function.prototype.bind.apply(Stackedcolumnchart, [null, $(this)].concat(args))));
        	}
        });
    };

}(jQuery));