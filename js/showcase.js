/* blah */

/* wipe_time_cache: destroy all non-visible layers (ie. cached time slices).
   in data mode, this gets called whenever the user pans or zooms.
   in story or tour mode, it gets called whenever a story starts */
function wipe_time_cache()
{
  current_time_id = td.getCurrentTime();
  
  // ... for each time layer synced to the time dimension...
  $.each(td._syncedLayers, function(sync_index, sync_value)
  {
    // ... and each time slice in the synced time layer...
    $.each(sync_value._layers, function(slice_index, slice_value)
    {
      // remove the slice if it doesn't match the current time
      if (slice_index != current_time_id)
      {
        console.log('Deleting cached time slice');
        mymap.removeLayer(slice_value);
      }
    });
  });
}

// initialise map
var mymap = L.map('map', {
  center: [10, 50],    // lat, lon
  zoom: 2,
  crs: L.CRS.EPSG4326,    // need a matching basemap!
  zoomControl: true,
  attributionControl: false // it's on the about screen instead
  // maxBoundsViscosity: 0.5
});
mymap.zoomControl.setPosition('topleft');

// L.control.zoom({
//      position:'topright'
// }).addTo(mymap);

// DEBUG - a heap of event listeners
// mymap.on('load', function() { console.log('load'); });
// mymap.on('zoom', function() { console.log('zoom'); });
// mymap.on('move', function() { console.log('move'); });

// initialise time dimension, control and player
var td = new L.TimeDimension({
  timeInterval: '1951-01-01T00:00:00.000Z/2017-01-01T00:00:00.000Z',
  period: 'P1Y'
});
mymap.timeDimension = td;
var td_player = new L.TimeDimension.Player({
  buffer: 5,     // control to taste
  loop: true,
  transitionTime: 250,
  startOver: true
}, td);
var td_control = new L.Control.TimeDimension({
  position: 'bottomleft',
  speedSlider: false,
  limitSliders: true,
  player: td_player
});
mymap.addControl(td_control);
// mymap.setMaxBounds([[-90, -30], [95, 360]]);
// when in data mode, wipe the time cache if the user pans/zooms/resizes
mymap.on('zoomlevelschange resize movestart', function() {
  if (app_mode == 'data')
  {
    wipe_time_cache();
  }
});

// initialise legend (with an empty pic to start)
var legend_dpi = 91;
var legend_url = geoserver_base +
  'REQUEST=GetLegendGraphic&VERSION=1.1.0&&FORMAT=image/png&height=12&' +
  'LEGEND_OPTIONS=fontName:Oswald;fontSize:12;fontColor:0x000000;dx:5;layout:horizontal;' +
  'dpi:' + legend_dpi +
  '&transparent=true&layer='
var legend = L.wmsLegend('img/1x1.png');

// add base tile layer
var base_tiles = L.tileLayer(
  'https://tile.gbif.org/4326/omt/{z}/{x}/{y}@1x.png?style=gbif-light',
  {
    subdomains: 'abcd',
    minZoom: 1,
    maxZoom: 16,
    ext: 'png',
    updateWhenIdle: false
  }).addTo(mymap);

// populate story menu and attach custom story code
// (legend update + transitions)
for (story of showcase_stories) {
  story.createMenuItem('stories-list');
  story.setMap(mymap);
  story.on('storyload', cleanup_for_story);
  story.on('storybitload', function(bit) {
    // update legend according to storybit baselayer
    //debugger;
    if (bit._baselayer === undefined) {
      legend.update('img/1x1.png');
    } else {
      console.log(bit);
      var lab_env = bit._baselayer.wmsParams.env,
        lab_units = bit._baselayer.wmsParams.leg_units,
        env_bits = lab_env.split(/:|;/),
        lab_low = env_bits[1] + ' ' + lab_units,
        lab_high = env_bits[env_bits.length - 1] + ' ' + lab_units;
      legend.update(legend_url + bit._baselayer.wmsParams.layers,
        lab_low, lab_high);
    }
  });
  story.on('storybitplay', storybit_ready);
  story.on('storybitend', function() {
    legend.update('img/1x1.png');
  });
}

function start_data_mode() {
  // remove old ui elements
  $('#nav-stories-list').removeClass('toggled_on');

  // turn ui elements on
  app_mode = 'data';
  turn_data_on();

  // set map view and time 
  td.setCurrentTime(1104537600000);
  mymap.flyTo([15, 100], 2);
}

function start_story_mode() {
  app_mode = 'stories';
  turn_data_off();
  turn_stories_list_on();
}

// function load_story(event) {
//   // use event.data.story_code to access stories
//   console.log('Story item clicked! ' + event.data.story_code);

//   $('#map-blackout').addClass('toggled_on').one('transitionend', function() {
    
//     // var story = stories[event.data.story_code];

//     // // wipe regular layers, the story list ui and the existing time cache
//     // for (var i = 0; i < climdex_indices_control._layerControlInputs.length; i++){
//     //   climdex_indices_control._layerControlInputs[i].checked = false;
//     // }
//     // climdex_indices_control._onInputClick();
//     // turn_stories_list_off();
//     // wipe_time_cache();

//     // now, set initial map view, legend and wipe 
//     mymap.setView(story.init.center_start, story.init.zoom, { animate: false });
//     legend.update(legend_url + story.init.base_layer);

//     // set upper/lower bounds and current time
//     var start_dt = new Date(story.init.year_start + '-01-01T00:00:00.000Z');
//     var end_dt = new (story.init.year_end + '-01-01T00:00:00.000Z');
//     if (td.getCurrentTime < start_dt) {
//       td.setUpperLimit(end_dt.valueOf());
//       td.setCurrentTime(start_dt.valueOf());
//       td.setLowerLimit(start_dt.valueOf());
//     } else {
//       td.setLowerLimit(start_dt.valueOf());
//       td.setCurrentTime(start_dt.valueOf());
//       td.setUpperLimit(end_dt.valueOf());
//     }

//     // get timedimension to prefetch the animation frames
//     td_player.setLooped(false);
//     td_player.setTransitionTime(5);
//     // td_player
//   });
// }

// decide which mode to initialise in (affects how we initialise)
var app_mode;
switch (window.location.search.substring(1)) {
  case 'stories':
    start_story_mode();
    break;
  case 'tour':
    // auto rotate stories
    break;
  case 'data':
  default:
    start_data_mode();
}
