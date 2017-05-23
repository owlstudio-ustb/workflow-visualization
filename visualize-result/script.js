var Dashboard = (function ($) {
    var module = {};

    var data = {};
    var div = "";
    var chartTypes = [];

    // delete quotes and replace punctuation to spaces
    module.formatString = function(str) {
      if(str[0] == '"' && str[0] == str[str.length - 1]) {
        str = str.substring(1, str.length - 1);
      }
      return str.replace(/([a-zA-Z]+)[.]([a-zA-Z]+)/g, "$1 $2");
    }

    module.init = function(inputData, types) {
      chartTypes = types;
      module.reset();
      module.initWithType(inputData, module.identifyType(inputData));
    }

    module.initWithType = function(inputData, type) {
      switch(type) {
      case "csv":
        module.readCsvData(inputData);
        break;
      case "arff":
        module.readArffData(inputData);
        break;
      default:
        console.log("Error document type!");
        return;
      }
    }

    module.identifyType = function(inputData) {
      function isArffData(data) {
        if (!data.match(/@relation/i)) {
          return false;
        }
        if (!data.match(/@attribute/i)) {
          return false;
        }
        if (!data.match(/@data/i)) {
          return false;
        }
        return true;
      }

      if(isArffData(inputData)) return "arff";
      else return "csv";
    }

    module.readCsvData = function(csvString) {
      // function to decide if parsing returns deadly result
      function parseErrorIsOk(error) {
        return (error.length == 0 || 
        (error.length == 1 && error[0].code == "UndetectableDelimiter"));
      }

      // check if the first row is header
      //
      // Criteria: if all row items in the 1st and 2nd rows are same
      //            then return true
      function hasHeader (data, headerArray, secondRow) {
        for(var ix = 0; ix < headerArray.length; ix++) {
          var mappedData = data.map(function(val) {
            return val[ix];
          });

          var matches = mappedData.filter(function(val) {
            return val == headerArray[ix];
          });

          if(isNaN(headerArray[ix]) != isNaN(secondRow[ix])) {
            return true;
          }
          else if(isNaN(headerArray[ix]) && matches.length == 1) {
            return true;
          }
        }
        return false;
      }

      // trial round: try parsing to guess delimiter and linebreak
      var previewResults = Papa.parse(csvString, {
        header: false,
        dynamicTyping: true,
        preview: 10,
        skipEmptyLines: true
      });

      // if parse result if not ok, then terminate and return
      if(!parseErrorIsOk(previewResults.errors)) {
        module.handleError(previewResults.errors[0].message);
        return;
      }

      // get delimiter and line break from preview parse result
      var delimiter = previewResults.meta.delimiter;
      var linebreak = previewResults.meta.linebreak;

      // check if the csv string represent a dataset with header row
      // note that csv header need not be right at this time
      var rowSplitRegex = new RegExp("[^" + linebreak + "]+", "g");
      var csvRows = csvString.match(rowSplitRegex);
      var csvHeader = csvRows[0].split(delimiter);
      var csvHasHeader = hasHeader(
        csvRows.splice(10).map(function(val) { return val.split(delimiter); }),
        csvHeader, 
        csvRows[1].split(delimiter)
      );

      if(csvHasHeader) {
        // if csv has header, then format the header and append it to the csv string
        csvString = csvHeader.map(module.formatString).join(delimiter) + linebreak
          + csvString.split(linebreak).splice(1).join(linebreak);

        // if the first column index is empty, then add one named "index"
        if(previewResults.data[0][0].trim() == "") {
          csvString = "Index" + csvString;
        }
      }
      else {
        // if csv doesn't have header, then add one to the csv string
        csvHeader = csvHeader.map(function(item, ix) {
          return "Column " + (ix + 1);
        });
        csvString = csvHeader.join(delimiter) + linebreak + csvString;
      }

      // generate entire parse result
      var parseResults = Papa.parse(csvString, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      csvHeader = Object.keys(parseResults.data[0]);

      if(!parseErrorIsOk(parseResults.errors)) {
        module.handleError(parseResults.errors[0].message);
        return;
      }

      // set module's data member
      data['data'] = parseResults.data;
      data['attribute'] = [];

      // set attribute types
      for(colIndex = 0; colIndex < csvHeader.length; colIndex++) {
        // view index as string and not include it in data analysis
        if(colIndex == 0 && csvHeader[0] == 'Index') {
          data['attribute'].push({
            "name": csvHeader[colIndex],
            "type": {
              "type": "string"
            }
          });
        }

        // identify numeric column
        else if(typeof data['data'][0][csvHeader[colIndex]] === 'number') {
          data['attribute'].push({
            "name": csvHeader[colIndex],
            "type": {
              "type": "numeric"
            }
          });
        }

        // in other cases, check whether string represents nominal data
        else {
          function onlyUnique(value, index, self) { 
            return self.indexOf(value) === index;
          }
          var uniqueArray = data['data'].map(function(item) { return item[csvHeader[colIndex]]; });
          uniqueArray = uniqueArray.filter(onlyUnique);
          if(uniqueArray.length < 10) {
            data['attribute'].push({
              "name": csvHeader[colIndex],
              "type": {
                "type": "nominal",
                "oneof": uniqueArray
              }
            });
          }
          else {
            data['attribute'].push({
              "name": csvHeader[colIndex],
              "type": {
                "type": "string"
              }
            });
          }
        }
      }

      // for debug: print the parsed data
      // console.log(data);
    }

    module.readArffData = function(csvString) {
      var section;
      var parsed = { 'relation': [], 'attribute': [], 'data': [] };

      function readLine(line) {
          if (!section) section = 'header';

          var chunks = line.trim().split(/[\s]+/);

          // skip blank lines and comments
          if (chunks.length === 1 && chunks[0] === '') return true;
          else if (/^%/.test(chunks[0])) {
            return true;
          }

          // relation name
          else if (/^@RELATION/i.test(chunks[0])) {
            if (section !== 'header') {
              console.log('@RELATION found outside of header');
              return false;
            }
            parsed['relation'].push(chunks[1]);
          }

          // attribute spec
          else if (/^@ATTRIBUTE/i.test(chunks[0])) {
            if (section != 'header') {
              console.log('@ATTRIBUTE found outside of header section');
              return false;
            }
            var name = chunks[1].replace(/['"]|:$/g, '');
            var type = parseAttributeType(chunks.slice(2).join(' '));
            parsed['attribute'].push({ "name": module.formatString(name), "type": type });
          }

          else if (/^@DATA/i.test(chunks[0])) {
            if (section == 'data') {
              console.log('@DATA found after DATA');
              return false;
            }
            section = 'data';
          }
          else {
            if (section == 'data') {
              var dataRow = chunks.join('').replace(/['"]/g, '').split(',');
              var parsedRow = {};
              for(var ix = 0; ix < dataRow.length; ix++) {
                var entryName = parsed["attribute"][ix]["name"];
                if(parsed["attribute"][ix]["type"]["type"] == "numeric") {
                  parsedRow["" + entryName] = parseFloat(dataRow[ix]);
                }
                else {
                  parsedRow["" + entryName] = dataRow[ix];
                }
              }
              parsed['data'].push(parsedRow);
            }
          }
          return true;
      }

      function parseAttributeType(type) {
        var finaltype = { "type": type };
        var parts;

        if (/^date/i.test(type)) {
          parts = type.split(/[\s]+/);
          var format = "yyyy-MM-dd'T'HH:mm:ss";
          if (parts.length > 1) {
            format = parts[1];
          }
          finaltype = {
            "type": 'date',
            "format": format
          }
        }
        else if (parts = type.match(/^{([^}]*)}$/)) {
          finaltype["type"] = 'nominal';
          finaltype["oneof"] = parts[1].replace(/[\s'"]/g, '').split(/,/);
        }
        else if (/^numeric|^integer|^real|^continuous/i.test(type)) {
          finaltype["type"] = 'numeric';
        }
        else if (/string/i.test(type)) {
          finaltype["type"] = 'string';
        }

        return finaltype;
      }

      var lines = csvString.match(/[^\r\n]+/g);

      for(lineIndex in lines) {
          if((lines[lineIndex].replace(/\s/g,''))[0] == '%') continue;
          if(readLine(lines[lineIndex]) == false) return;
      }

      // for debug: log parsed data
      // console.log(parsed);

      data = parsed;
    }

    /* handle error */
    module.handleError = function(errMsg) {
      $(".ui.look.button").addClass("disabled");
      var $errmsg = $(".errmsg.modal");
      $errmsg.find('.description').text(errMsg);
      $errmsg.modal('settings', {
        closable  : false
      }).modal('show');
      module.reset();    
      $(".header-dropdown").dropdown('restore defaults');
    }

    /* plotting */

    module.draw = function(divCode = ".graph-content") {
      div = divCode;

      for(ix in chartTypes) {
        var funcName = chartTypes[ix];
        module[funcName].init($(div + ' .' + funcName), data);
      }
    }

    module.reset = function() {
      data = {};

      /* hide all graphs */
      $(".graph-content > .column").addClass("hidden");

      /* reset all graphs */
      for(ix in chartTypes) {
        var funcName = chartTypes[ix];
        module[funcName].reset();
      }
    }

    return module;

}(jQuery));

