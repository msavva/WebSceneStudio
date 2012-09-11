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
	controlPanel.append(makeOrbitControl());
	
	// Move control
	controlPanel.append(makeMoveControl());
	
	// Zoom control
	controlPanel.append(makeZoomControl());
	
	// Home button
	controlPanel.append(makeHomeButton());
	
	
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

function makeOrbitControl()
{	
	return makeDpadControl('orbitControl', Constants.resourceDir + 'camera_icons/orbit.png', 'Orbit camera (Right mouse drag)',
						   null, null, null, null);
}

function makeMoveControl()
{
	return makeDpadControl('moveControl', Constants.resourceDir + 'camera_icons/move.png', 'Dolly camera (Middle mouse drag)',
						   null, null, null, null);
}

function makeDpadControl(id, iconUrl, tooltip, leftCallback, rightCallback, upCallback, downCallback)
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
		.click(leftCallback)
	);
	
	// Right button
	container.append(
		$('<div>\u25BA</div>')
		.attr('id', id+'RightButton')
		.addClass('cameraControlsButton')
		.addClass('dpadButton')
		.addClass('dpadRightButton')
		.click(rightCallback)
	);
	
	// Up button
	container.append(
		$('<div>\u25B2</div>')
		.attr('id', id+'UpButton')
		.addClass('cameraControlsButton')
		.addClass('dpadButton')
		.addClass('dpadUpButton')
		.click(upCallback)
	);
	
	// Down button
	container.append(
		$('<div>\u25BC</div>')
		.attr('id', id+'DownButton')
		.addClass('cameraControlsButton')
		.addClass('dpadButton')
		.addClass('dpadDownButton')
		.click(downCallback)
	);
	
	return container;
}

function makeZoomControl()
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
	);
	
	// Plus button
	container.append(
		$('<div>+</div>')
		.attr('id', 'zoomPlusButton')
		.addClass('cameraControlsButton')
		.addClass('zoomButton')
	);
	
	return container;
}

function makeHomeButton()
{
	var iconURL = Constants.resourceDir + 'camera_icons/home';
	var button =  $('<img></img>')
				.attr('src', iconURL + '_normal.png')
				.attr('id', 'homeButton')
				.attr('title', 'Reset camera')
				.addClass('cameraControlsButton')
				.bind('dragstart', NoDrag);
	makeImageButtonHighlightCorrectly(button, iconURL);
	return button;
}


// Exports
return CameraControls;
	
});