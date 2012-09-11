'use strict'

define([
	'Constants',
	'jquery'
],
function(Constants){
	
function CameraControls(app)
{
	this.app = app;
	var container = $('#cameraControls');
	
	/** Set up the controls **/
	
	// Main camera button
	container.append(makeCameraButton());
	
	// Control panel
	var controlPanel = $('<div></div>').attr('id', 'cameraControlPanel');
	container.append(controlPanel);
	
	// Orbit control
	controlPanel.append(makeOrbitControl(app));
	
	// Move control
	controlPanel.append(makeMoveControl(app));
	
	// Zoom control
	controlPanel.append(makeZoomControl(app));
	
	// Home button
	controlPanel.append(makeHomeButton(app));
	
	
	// Initially hide the controls
	controlPanel.hide();
}

function NoDrag(event)
{
	event.preventDefault();
}

function makeImageButtonHighlightCorrectly(button, iconURL)
{
	// Change the icon color when the button is active
	button.mousedown(function(event) {
		button.attr('src', iconURL + '_active.png');
		var mouseup = function(event) {
			button.attr('src', iconURL + '_normal.png');
			$(document).unbind('mouseup', mouseup);
		};
		$(document).mouseup(mouseup);	
	});
}

function makeCameraButton()
{
	var iconURL = Constants.resourceDir + 'camera_icons/camera'
	var showTooltip = 'Show camera controls';
	var hideTooltip = 'Hide camera controls';
	var button =  $('<img></img>')
					.attr('src', iconURL + '_normal.png')
					.attr('id', 'cameraButton')
					.attr('title', showTooltip)
					.addClass('cameraControlsButton')
					.bind('dragstart', NoDrag)
					.click(function(event){
						var controlPanel = $('#cameraControlPanel');
						if (controlPanel.is(':visible'))
						{
							controlPanel.hide();
							button.attr('title', showTooltip);
						}
						else
						{
							controlPanel.show();
							button.attr('title', hideTooltip);
						}
					});
	makeImageButtonHighlightCorrectly(button, iconURL);
	return button;
}

function makeOrbitControl(app)
{	
	return makeDpadControl(app, 'orbitControl', Constants.resourceDir + 'camera_icons/orbit.png', 'Orbit camera (Right mouse drag)',
						   {
								'left' : function(event)
								{
									app.camera.OrbitLeft(-Constants.cameraWidgetOrbitLeftAmt);
									app.UpdateView();
								},
								'right' : function(event)
								{
									app.camera.OrbitLeft(Constants.cameraWidgetOrbitLeftAmt);
									app.UpdateView();
								},
								'up' : function(event)
								{
									app.camera.OrbitUp(Constants.cameraWidgetOrbitUpAmt);
									app.UpdateView();
								},
								'down' : function(event)
								{
									app.camera.OrbitUp(-Constants.cameraWidgetOrbitUpAmt);
									app.UpdateView();
								}
						   });
}

function makeMoveControl(app)
{
	return makeDpadControl(app, 'moveControl', Constants.resourceDir + 'camera_icons/move.png', 'Dolly camera (Middle mouse drag)',
						   {
								'left' : function(event)
								{
									app.camera.DollyLeft(Constants.cameraWidgetDollyAmt);
									app.UpdateView();
								},
								'right' : function(event)
								{
									app.camera.DollyLeft(-Constants.cameraWidgetDollyAmt);
									app.UpdateView();
								},
								'up' : function(event)
								{
									app.camera.DollyUp(Constants.cameraWidgetDollyAmt);
									app.UpdateView();
								},
								'down' : function(event)
								{
									app.camera.DollyUp(-Constants.cameraWidgetDollyAmt);
									app.UpdateView();
								}
						   });
}

function makeDpadControl(app, id, iconUrl, tooltip, callbacks)
{
	var container = $('<div></div>')
					.attr('id', id)
					.addClass('dpadContainer');
	
	// Icon
	container.append(
		$('<div></div>')
		.addClass('dpadIconHolder')
		.append(
			$('<img></img>')
			.attr('src', iconUrl)
			.attr('id', id+'Icon')
			.attr('title', tooltip)
			.addClass('dpadIcon')
			.bind('dragstart', NoDrag)
		)
	);
	
	// Left button
	container.append(
		$('<div>\u25C4</div>')
		.attr('id', id+'LeftButton')
		.addClass('cameraControlsButton')
		.addClass('dpadButton')
		.addClass('dpadLeftButton')
		.click(callbacks && callbacks.left)
	);
	
	// Right button
	container.append(
		$('<div>\u25BA</div>')
		.attr('id', id+'RightButton')
		.addClass('cameraControlsButton')
		.addClass('dpadButton')
		.addClass('dpadRightButton')
		.click(callbacks && callbacks.right)
	);
	
	// Up button
	container.append(
		$('<div>\u25B2</div>')
		.attr('id', id+'UpButton')
		.addClass('cameraControlsButton')
		.addClass('dpadButton')
		.addClass('dpadUpButton')
		.click(callbacks && callbacks.up)
	);
	
	// Down button
	container.append(
		$('<div>\u25BC</div>')
		.attr('id', id+'DownButton')
		.addClass('cameraControlsButton')
		.addClass('dpadButton')
		.addClass('dpadDownButton')
		.click(callbacks && callbacks.down)
	);
	
	return container;
}

function makeZoomControl(app)
{
	var container = $('<div></div>').attr('id', 'zoomControl');
	
	// Icon
	container.append(
		$('<div></div>')
		.addClass('zoomIconHolder')
		.append(
			$('<img></img>')
			.attr('src', Constants.resourceDir + 'camera_icons/zoom.png')
			.attr('id', 'zoomIcon')
			.attr('title', 'Zoom camera (Mouse wheel)')
			.bind('dragstart', NoDrag)
		)
	);
	
	// Minus button
	container.append(
		$('<div>-</div>')
		.attr('id', 'zoomMinusButton')
		.addClass('cameraControlsButton')
		.addClass('zoomButton')
		.click(function(event) {
			app.camera.Zoom(-Constants.cameraWidgetZoomAmt);
			app.UpdateView();
		})
	);
	
	// Plus button
	container.append(
		$('<div>+</div>')
		.attr('id', 'zoomPlusButton')
		.addClass('cameraControlsButton')
		.addClass('zoomButton')
		.click(function(event) {
			app.camera.Zoom(Constants.cameraWidgetZoomAmt);
			app.UpdateView();
		})
	);
	
	return container;
}

function makeHomeButton(app)
{
	var iconURL = Constants.resourceDir + 'camera_icons/home';
	var button =  $('<img></img>')
				.attr('src', iconURL + '_normal.png')
				.attr('id', 'homeButton')
				.attr('title', 'Reset camera')
				.addClass('cameraControlsButton')
				.bind('dragstart', NoDrag)
				.click(function(event) {
					app.camera.ResetSavedState();
					app.UpdateView();
				});
	makeImageButtonHighlightCorrectly(button, iconURL);
	return button;
}


// Exports
return CameraControls;
	
});