(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined'
		? (module.exports = factory())
		: typeof define === 'function' && define.amd
		? define(factory)
		: ((global = typeof globalThis !== 'undefined' ? globalThis : global || self), (global.sequentialWorkflowDesigner = factory()));
})(this, function () {
	'use strict';
	//this is  a vector
	class Vector {
		constructor(x, y) {
			this.x = x;
			this.y = y;
		}
		add(v) {
			return new Vector(this.x + v.x, this.y + v.y);
		}
		subtract(v) {
			return new Vector(this.x - v.x, this.y - v.y);
		}
		multiplyByScalar(s) {
			return new Vector(this.x * s, this.y * s);
		}
		divideByScalar(s) {
			return new Vector(this.x / s, this.y / s);
		}
		round() {
			return new Vector(Math.round(this.x), Math.round(this.y));
		}
		distance() {
			return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
		}
	}

	function readMousePosition(e) {
		return new Vector(e.clientX, e.clientY);
	}
	function readTouchPosition(e) {
		if (e.touches.length > 0) {
			const touch = e.touches[0];
			return new Vector(touch.clientX, touch.clientY);
		}
		throw new Error('Unknown touch position');
	}

	class BehaviorController {
		constructor() {
			this.onMouseMoveHandler = e => this.onMouseMove(e);
			this.onMouseUpHandler = e => this.onMouseUp(e);
			this.onTouchMoveHandler = e => this.onTouchMove(e);
			this.onTouchEndHandler = e => this.onTouchEnd(e);
			this.onTouchStartHandler = e => this.onTouchStart(e);
		}
		start(startPosition, behavior) {
			if (this.state) {
				this.stop(true);
				return;
			}
			this.state = {
				startPosition,
				behavior
			};
			behavior.onStart(this.state.startPosition); // Step 4 add event listener
			window.addEventListener('mousemove', this.onMouseMoveHandler, false);
			window.addEventListener('touchmove', this.onTouchMoveHandler, false);
			window.addEventListener('mouseup', this.onMouseUpHandler, false);
			window.addEventListener('touchend', this.onTouchEndHandler, false);
			window.addEventListener('touchstart', this.onTouchStartHandler, false);
		}
		onMouseMove(e) {
			e.preventDefault();
			this.move(readMousePosition(e));
		}
		onTouchMove(e) {
			e.preventDefault();
			this.move(readTouchPosition(e));
		}
		onMouseUp(e) {
			e.preventDefault();
			this.stop(false);
		}
		onTouchEnd(e) {
			e.preventDefault();
			this.stop(false);
		}
		onTouchStart(e) {
			e.preventDefault();
			if (e.touches.length !== 1) {
				this.stop(true);
			}
		}
		move(position) {
			if (!this.state) {
				throw new Error('State is empty');
			}
			const delta = this.state.startPosition.subtract(position);
			const newBehavior = this.state.behavior.onMove(delta);
			if (newBehavior) {
				this.state.behavior.onEnd(true);
				this.state.behavior = newBehavior;
				this.state.startPosition = position;
				this.state.behavior.onStart(this.state.startPosition);
			}
		}
		stop(interrupt) {
			if (!this.state) {
				throw new Error('State is empty');
			}
			window.removeEventListener('mousemove', this.onMouseMoveHandler, false);
			window.removeEventListener('touchmove', this.onTouchMoveHandler, false);
			window.removeEventListener('mouseup', this.onMouseUpHandler, false);
			window.removeEventListener('touchend', this.onTouchEndHandler, false);
			window.removeEventListener('touchstart', this.onTouchEndHandler, false);
			this.state.behavior.onEnd(interrupt);
			this.state = undefined;
		}
	}

	class ObjectCloner {
		static deepClone(instance) {
			if (typeof window.structuredClone !== 'undefined') {
				return window.structuredClone(instance);
			}
			return JSON.parse(JSON.stringify(instance));
		}
	}

	class SimpleEvent {
		constructor() {
			this.listeners = [];
		}
		subscribe(listener) {
			this.listeners.push(listener);
		}
		unsubscribe(listener) {
			const index = this.listeners.indexOf(listener);
			if (index >= 0) {
				this.listeners.splice(index, 1);
			} else {
				throw new Error('Unknown listener');
			}
		}
		forward(value) {
			if (this.listeners.length > 0) {
				this.listeners.forEach(listener => listener(value));
			}
		}
		count() {
			return this.listeners.length;
		}
	}

	function animate(interval, handler) {
		const iv = setInterval(tick, 15);
		const startTime = Date.now();
		const anim = {
			isAlive: true,
			stop: () => {
				anim.isAlive = false;
				clearInterval(iv);
			}
		};
		function tick() {
			const progress = Math.min((Date.now() - startTime) / interval, 1);
			handler(progress);
			if (progress === 1) {
				anim.stop();
			}
		}
		return anim;
	}

	class SequenceModifier {
		static moveStep(sourceSequence, step, targetSequence, targetIndex) {
			const sourceIndex = sourceSequence.indexOf(step);
			if (sourceIndex < 0) {
				throw new Error('Unknown step');
			}
			const isSameSequence = sourceSequence === targetSequence;
			if (isSameSequence && sourceIndex === targetIndex) {
				return; // Nothing to do.
			}
			sourceSequence.splice(sourceIndex, 1);
			if (isSameSequence && sourceIndex < targetIndex) {
				targetIndex--;
			}
			targetSequence.splice(targetIndex, 0, step);
		}
		static insertStep(step, targetSequence, targetIndex) {
			targetSequence.splice(targetIndex, 0, step);
		}
		static deleteStep(step, parentSequence) {
			const index = parentSequence.indexOf(step);
			if (index < 0) {
				throw new Error('Unknown step');
			}
			parentSequence.splice(index, 1);
		}
	}

	const MIN_SCALE = 0.1;
	const MAX_SCALE = 3;
	class DesignerContext {
		constructor(definition, behaviorController, layoutController, configuration, isToolboxCollapsed, isSmartEditorCollapsed) {
			this.definition = definition;
			this.behaviorController = behaviorController;
			this.layoutController = layoutController;
			this.configuration = configuration;
			this.isToolboxCollapsed = isToolboxCollapsed;
			this.isSmartEditorCollapsed = isSmartEditorCollapsed;
			this.onViewPortChanged = new SimpleEvent();
			this.onSelectedStepChanged = new SimpleEvent();
			this.onIsReadonlyChanged = new SimpleEvent();
			this.onIsDraggingChanged = new SimpleEvent();
			this.onIsMoveModeEnabledChanged = new SimpleEvent();
			this.onIsToolboxCollapsedChanged = new SimpleEvent();
			this.onIsSmartEditorCollapsedChanged = new SimpleEvent();
			this.onDefinitionChanged = new SimpleEvent();
			this.viewPort = {
				position: new Vector(0, 0),
				scale: 1
			};
			this.selectedStep = null;
			this.isDragging = false;
			this.isMoveModeEnabled = false;
			this.isReadonly = !!configuration.isReadonly;
		}
		setViewPort(position, scale) {
			this.viewPort = { position, scale };
			this.onViewPortChanged.forward(this.viewPort);
		}
		resetViewPort() {
			this.getProvider().resetViewPort();
		}
		animateViewPort(position, scale) {
			if (this.viewPortAnimation && this.viewPortAnimation.isAlive) {
				this.viewPortAnimation.stop();
			}
			const startPosition = this.viewPort.position;
			const startScale = this.viewPort.scale;
			const deltaPosition = startPosition.subtract(position);
			const deltaScale = startScale - scale;
			this.viewPortAnimation = animate(150, progress => {
				const newScale = startScale - deltaScale * progress;
				this.setViewPort(startPosition.subtract(deltaPosition.multiplyByScalar(progress)), newScale);
			});
		}
		moveViewPortToStep(stepId) {
			const component = this.getProvider().getComponentByStepId(stepId);
			this.getProvider().moveViewPortToStep(component);
		}
		limitScale(scale) {
			return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
		}
		zoom(direction) {
			this.getProvider().zoom(direction);
		}
		setSelectedStep(step) {
			if (this.selectedStep !== step) {
				this.selectedStep = step;
				this.onSelectedStepChanged.forward(step);
			}
		}
		selectStepById(stepId) {
			const component = this.getProvider().getComponentByStepId(stepId);
			this.setSelectedStep(component.step);
		}
		tryInsertStep(step, targetSequence, targetIndex) {
			const canInsertStep = this.configuration.steps.canInsertStep
				? this.configuration.steps.canInsertStep(step, targetSequence, targetIndex)
				: true;
			if (!canInsertStep) {
				return false;
			}
			SequenceModifier.insertStep(step, targetSequence, targetIndex);
			this.notifiyDefinitionChanged(true);
			this.setSelectedStep(step);
			return true;
		}
		tryMoveStep(sourceSequence, step, targetSequence, targetIndex) {
			const canMoveStep = this.configuration.steps.canMoveStep
				? this.configuration.steps.canMoveStep(sourceSequence, step, targetSequence, targetIndex)
				: true;
			if (!canMoveStep) {
				return false;
			}
			SequenceModifier.moveStep(sourceSequence, step, targetSequence, targetIndex);
			this.notifiyDefinitionChanged(true);
			this.setSelectedStep(step);
			return true;
		}
		tryDeleteStep(step) {
			var _a;
			const component = this.getProvider().getComponentByStepId(step.id);
			const canDeleteStep = this.configuration.steps.canDeleteStep
				? this.configuration.steps.canDeleteStep(component.step, component.parentSequence)
				: true;
			if (!canDeleteStep) {
				return false;
			}
			SequenceModifier.deleteStep(component.step, component.parentSequence);
			this.notifiyDefinitionChanged(true);
			if (((_a = this.selectedStep) === null || _a === void 0 ? void 0 : _a.id) === step.id) {
				this.setSelectedStep(null);
			}
			return true;
		}
		setIsReadonly(isReadonly) {
			this.isReadonly = isReadonly;
			this.onIsReadonlyChanged.forward(isReadonly);
		}
		setIsDragging(isDragging) {
			this.isDragging = isDragging;
			this.onIsDraggingChanged.forward(isDragging);
		}
		toggleIsMoveModeEnabled() {
			this.isMoveModeEnabled = !this.isMoveModeEnabled;
			this.onIsMoveModeEnabledChanged.forward(this.isMoveModeEnabled);
		}
		toggleIsToolboxCollapsed() {
			this.isToolboxCollapsed = !this.isToolboxCollapsed;
			this.onIsToolboxCollapsedChanged.forward(this.isToolboxCollapsed);
		}
		toggleIsSmartEditorCollapsed() {
			this.onIsSmartEditorCollapsedChanged.forward(this.isSmartEditorCollapsed);
		}
		openSmartEditor() {
			this.onIsSmartEditorCollapsedChanged.forward(false);
		}
		notifiyDefinitionChanged(rerender) {
			this.onDefinitionChanged.forward({ rerender });
		}
		getPlaceholders() {
			return this.getProvider().getPlaceholders();
		}
		setProvider(provider) {
			this.provider = provider;
		}
		getProvider() {
			if (!this.provider) {
				throw new Error('Provider is not set');
			}
			return this.provider;
		}
	}

	class Dom {
		static svg(name, attributes) {
			const element = document.createElementNS('http://www.w3.org/2000/svg', name);
			if (attributes) {
				Dom.attrs(element, attributes);
			}
			return element;
		}
		static translate(element, x, y) {
			element.setAttribute('transform', `translate(${x}, ${y})`);
		}
		static attrs(element, attributes) {
			Object.keys(attributes).forEach(name => {
				const value = attributes[name];
				element.setAttribute(name, typeof value === 'string' ? value : value.toString());
			});
		}
		static element(name, attributes) {
			const element = document.createElement(name);
			if (attributes) {
				Dom.attrs(element, attributes);
			}
			return element;
		}
		static toggleClass(element, isEnabled, className) {
			if (isEnabled) {
				element.classList.add(className);
			} else {
				element.classList.remove(className);
			}
		}
	}

	// Icons source: https://github.com/google/material-design-icons
	class Icons {
		static create(className, content) {
			const icon = Dom.svg('svg', {
				class: className,
				viewBox: '0 0 24 24'
			});
			if (content) {
				icon.innerHTML = content;
			}
			return icon;
		}
	}
	Icons.center =
		'<path d="M4 15c-.55 0-1 .45-1 1v3c0 1.1.9 2 2 2h3c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1-.45-1-1v-2c0-.55-.45-1-1-1zm1-9c0-.55.45-1 1-1h2c.55 0 1-.45 1-1s-.45-1-1-1H5c-1.1 0-2 .9-2 2v3c0 .55.45 1 1 1s1-.45 1-1V6zm14-3h-3c-.55 0-1 .45-1 1s.45 1 1 1h2c.55 0 1 .45 1 1v2c0 .55.45 1 1 1s1-.45 1-1V5c0-1.1-.9-2-2-2zm0 15c0 .55-.45 1-1 1h-2c-.55 0-1 .45-1 1s.45 1 1 1h3c1.1 0 2-.9 2-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v2zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>';
	Icons.delete =
		'<path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm4.3 14.3a.996.996 0 0 1-1.41 0L12 13.41 9.11 16.3a.996.996 0 1 1-1.41-1.41L10.59 12 7.7 9.11A.996.996 0 1 1 9.11 7.7L12 10.59l2.89-2.89a.996.996 0 1 1 1.41 1.41L13.41 12l2.89 2.89c.38.38.38 1.02 0 1.41z" fill="#E01A24"/>';
	Icons.move =
		'<path d="M10.5 9h3c.28 0 .5-.22.5-.5V6h1.79c.45 0 .67-.54.35-.85l-3.79-3.79c-.2-.2-.51-.2-.71 0L7.85 5.15a.5.5 0 0 0 .36.85H10v2.5c0 .28.22.5.5.5zm-2 1H6V8.21c0-.45-.54-.67-.85-.35l-3.79 3.79c-.2.2-.2.51 0 .71l3.79 3.79a.5.5 0 0 0 .85-.36V14h2.5c.28 0 .5-.22.5-.5v-3c0-.28-.22-.5-.5-.5zm14.15 1.65-3.79-3.79a.501.501 0 0 0-.86.35V10h-2.5c-.28 0-.5.22-.5.5v3c0 .28.22.5.5.5H18v1.79c0 .45.54.67.85.35l3.79-3.79c.2-.19.2-.51.01-.7zM13.5 15h-3c-.28 0-.5.22-.5.5V18H8.21c-.45 0-.67.54-.35.85l3.79 3.79c.2.2.51.2.71 0l3.79-3.79a.5.5 0 0 0-.35-.85H14v-2.5c0-.28-.22-.5-.5-.5z"/>';
	Icons.options =
		'<path d="M19.5 12c0-.23-.01-.45-.03-.68l1.86-1.41c.4-.3.51-.86.26-1.3l-1.87-3.23a.987.987 0 0 0-1.25-.42l-2.15.91c-.37-.26-.76-.49-1.17-.68l-.29-2.31c-.06-.5-.49-.88-.99-.88h-3.73c-.51 0-.94.38-1 .88l-.29 2.31c-.41.19-.8.42-1.17.68l-2.15-.91c-.46-.2-1-.02-1.25.42L2.41 8.62c-.25.44-.14.99.26 1.3l1.86 1.41a7.343 7.343 0 0 0 0 1.35l-1.86 1.41c-.4.3-.51.86-.26 1.3l1.87 3.23c.25.44.79.62 1.25.42l2.15-.91c.37.26.76.49 1.17.68l.29 2.31c.06.5.49.88.99.88h3.73c.5 0 .93-.38.99-.88l.29-2.31c.41-.19.8-.42 1.17-.68l2.15.91c.46.2 1 .02 1.25-.42l1.87-3.23c.25-.44.14-.99-.26-1.3l-1.86-1.41c.03-.23.04-.45.04-.68zm-7.46 3.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>';
	Icons.close =
		'<path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>';
	Icons.arrowDown =
		'<path d="M8.12 9.29 12 13.17l3.88-3.88a.996.996 0 1 1 1.41 1.41l-4.59 4.59a.996.996 0 0 1-1.41 0L6.7 10.7a.996.996 0 0 1 0-1.41c.39-.38 1.03-.39 1.42 0z"/>';
	Icons.zoomIn =
		'<path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/><path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>';
	Icons.zoomOut =
		'<path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.26 4.25c.41.41 1.07.41 1.48 0l.01-.01c.41-.41.41-1.07 0-1.48L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm-2-5h4c.28 0 .5.22.5.5s-.22.5-.5.5h-4c-.28 0-.5-.22-.5-.5s.22-.5.5-.5z"/>';

	class ControlBarView {
		constructor(resetButton, zoomInButton, zoomOutButton, moveButton, deleteButton) {
			this.resetButton = resetButton;
			this.zoomInButton = zoomInButton;
			this.zoomOutButton = zoomOutButton;
			this.moveButton = moveButton;
			this.deleteButton = deleteButton;
		}
		static create(parent) {
			const root = Dom.element('div', {
				class: 'sqd-control-bar'
			});
			const deleteButton = createButton(Icons.delete, 'Delete selected step');
			deleteButton.classList.add('sqd-hidden');
			const resetButton = createButton(Icons.center, 'Reset');
			const zoomInButton = createButton(Icons.zoomIn, 'Zoom in');
			const zoomOutButton = createButton(Icons.zoomOut, 'Zoom out');
			const moveButton = createButton(Icons.move, 'Turn on/off drag and drop');
			moveButton.classList.add('sqd-disabled');
			root.appendChild(resetButton);
			root.appendChild(zoomInButton);
			root.appendChild(zoomOutButton);
			root.appendChild(moveButton);
			root.appendChild(deleteButton);
			parent.appendChild(root);
			return new ControlBarView(resetButton, zoomInButton, zoomOutButton, moveButton, deleteButton);
		}
		bindResetButtonClick(handler) {
			bindClick(this.resetButton, handler);
		}
		bindZoomInButtonClick(handler) {
			bindClick(this.zoomInButton, handler);
		}
		bindZoomOutButtonClick(handler) {
			bindClick(this.zoomOutButton, handler);
		}
		bindMoveButtonClick(handler) {
			bindClick(this.moveButton, handler);
		}
		bindDeleteButtonClick(handler) {
			bindClick(this.deleteButton, handler);
		}
		setIsDeleteButtonHidden(isHidden) {
			Dom.toggleClass(this.deleteButton, isHidden, 'sqd-hidden');
		}
		setIsMoveButtonDisabled(isDisabled) {
			Dom.toggleClass(this.moveButton, isDisabled, 'sqd-disabled');
		}
	}
	function bindClick(element, handler) {
		element.addEventListener(
			'click',
			e => {
				e.preventDefault();
				handler();
			},
			false
		);
	}
	function createButton(iconContent, title) {
		const button = Dom.element('div', {
			class: 'sqd-control-bar-button',
			title
		});
		const icon = Icons.create('sqd-control-bar-button-icon', iconContent);
		button.appendChild(icon);
		return button;
	}

	class ControlBar {
		constructor(view, context) {
			this.view = view;
			this.context = context;
		}
		static create(parent, context) {
			const view = ControlBarView.create(parent);
			const bar = new ControlBar(view, context);
			view.bindResetButtonClick(() => bar.onResetButtonClicked());
			view.bindZoomInButtonClick(() => bar.onZoomInButtonClicked());
			view.bindZoomOutButtonClick(() => bar.onZoomOutButtonClicked());
			view.bindMoveButtonClick(() => bar.onMoveButtonClicked());
			view.bindDeleteButtonClick(() => bar.onDeleteButtonClicked());
			context.onIsReadonlyChanged.subscribe(() => bar.onIsReadonlyChanged());
			context.onSelectedStepChanged.subscribe(() => bar.onSelectedStepChanged());
			context.onIsMoveModeEnabledChanged.subscribe(i => bar.onIsMoveModeEnabledChanged(i));
			return bar;
		}
		onResetButtonClicked() {
			this.context.resetViewPort();
		}
		onZoomInButtonClicked() {
			this.context.zoom(true);
		}
		onZoomOutButtonClicked() {
			this.context.zoom(false);
		}
		onMoveButtonClicked() {
			this.context.toggleIsMoveModeEnabled();
			if (this.context.selectedStep) {
				this.context.setSelectedStep(null);
			}
		}
		onDeleteButtonClicked() {
			if (this.context.selectedStep) {
				this.context.tryDeleteStep(this.context.selectedStep);
			}
		}
		onIsReadonlyChanged() {
			this.refreshDeleteButtonVisibility();
		}
		onSelectedStepChanged() {
			this.refreshDeleteButtonVisibility();
		}
		onIsMoveModeEnabledChanged(isEnabled) {
			this.view.setIsMoveButtonDisabled(!isEnabled);
		}
		refreshDeleteButtonVisibility() {
			const isHidden = !this.context.selectedStep || this.context.isReadonly;
			this.view.setIsDeleteButtonHidden(isHidden);
		}
	}

	class GlobalEditorView {
		constructor(root) {
			this.root = root;
		}
		static create(content) {
			const se = Dom.element('div', {
				class: 'sqd-global-editor'
			});
			se.appendChild(content);
			return new GlobalEditorView(se);
		}
	}

	class GlobalEditor {
		constructor(view) {
			this.view = view;
		}
		static create(definition, context) {
			const editorContext = {
				notifyPropertiesChanged: () => {
					context.notifiyDefinitionChanged(false);
				}
			};
			const content = context.configuration.editors.globalEditorProvider(definition, editorContext);
			const view = GlobalEditorView.create(content);
			return new GlobalEditor(view);
		}
	}

	class SmartEditorView {
		constructor(root, toggle, toggleIcon) {
			this.root = root;
			this.toggle = toggle;
			this.toggleIcon = toggleIcon;
		}
		static create(parent) {
			const root = Dom.element('div', {
				class: 'sqd-smart-editor'
			});
			const toggle = Dom.element('div', {
				class: 'sqd-smart-editor-toggle',
				title: 'Toggle editor'
			});
			const toggleIcon = Icons.create('sqd-smart-editor-toggle-icon');
			toggle.appendChild(toggleIcon);
			parent.appendChild(toggle);
			parent.appendChild(root);
			return new SmartEditorView(root, toggle, toggleIcon);
		}
		bindToggleIsCollapsedClick(handler) {
			this.toggle.addEventListener(
				'click',
				e => {
					e.preventDefault();
					handler();
				},
				false
			);
		}
		setIsCollapsed(isCollapsed) {
			Dom.toggleClass(this.root, isCollapsed, 'sqd-hidden');
			Dom.toggleClass(this.toggle, isCollapsed, 'sqd-collapsed');
			this.toggleIcon.innerHTML = isCollapsed ? Icons.options : Icons.close;
		}
		setView(view) {
			if (this.view) {
				this.root.removeChild(this.view.root);
			}
			this.root.appendChild(view.root);
			this.view = view;
		}
	}

	class StepEditorView {
		constructor(root) {
			this.root = root;
		}
		static create(content) {
			const root = Dom.element('div', {
				class: 'sqd-step-editor'
			});
			root.appendChild(content);
			return new StepEditorView(root);
		}
	}

	class StepEditor {
		constructor(view) {
			this.view = view;
		}
		static create(step, context) {
			const editorContext = {
				notifyPropertiesChanged: () => {
					context.notifiyDefinitionChanged(false);
				},
				notifyNameChanged: () => {
					context.notifiyDefinitionChanged(true);
				}
			};
			const content = context.configuration.editors.stepEditorProvider(step, editorContext);
			const view = StepEditorView.create(content);
			return new StepEditor(view);
		}
	}

	class SmartEditor {
		constructor(view, context) {
			this.view = view;
			this.context = context;
			this.currentStep = undefined;
		}
		static create(parent, context) {
			const view = SmartEditorView.create(parent);
			view.setIsCollapsed(context.isSmartEditorCollapsed);
			const editor = new SmartEditor(view, context);
			view.bindToggleIsCollapsedClick(() => editor.toggleIsCollapsedClick());
			editor.tryRender(null);
			context.onSelectedStepChanged.subscribe(s => editor.onSelectedStepChanged(s));
			context.onDefinitionChanged.subscribe(() => editor.onDefinitionChanged());
			context.onIsSmartEditorCollapsedChanged.subscribe(ic => view.setIsCollapsed(ic));
			return editor;
		}
		toggleIsCollapsedClick() {
			this.context.toggleIsSmartEditorCollapsed();
		}
		onSelectedStepChanged(step) {
			this.tryRender(step);
		}
		onDefinitionChanged() {
			this.tryRender(this.context.selectedStep);
		}
		tryRender(step) {
			if (this.currentStep !== step) {
				const editor = step ? StepEditor.create(step, this.context) : GlobalEditor.create(this.context.definition, this.context);
				this.currentStep = step;
				this.view.setView(editor.view);
			}
		}
	}

	class ScrollBoxView {
		constructor(root, viewport) {
			this.root = root;
			this.viewport = viewport;
			this.onResizeHandler = () => this.onResize();
			this.onTouchMoveHandler = e => this.onTouchMove(e);
			this.onMouseMoveHandler = e => this.onMouseMove(e);
			this.onTouchEndHandler = e => this.onTouchEnd(e);
			this.onMouseUpHandler = e => this.onMouseUp(e);
		}
		static create(parent, viewport) {
			const root = Dom.element('div', {
				class: 'sqd-scrollbox'
			});
			parent.appendChild(root);
			const view = new ScrollBoxView(root, viewport);
			window.addEventListener('resize', view.onResizeHandler, false);
			root.addEventListener('wheel', e => view.onWheel(e), false);
			root.addEventListener('touchstart', e => view.onTouchStart(e), false);
			root.addEventListener('mousedown', e => view.onMouseDown(e), false);
			return view;
		}
		setContent(element) {
			if (this.content) {
				this.root.removeChild(this.content.element);
			}
			element.classList.add('sqd-scrollbox-body');
			this.root.appendChild(element);
			this.reload(element);
		}
		refresh() {
			if (this.content) {
				this.reload(this.content.element);
			}
		}
		destroy() {
			window.removeEventListener('resize', this.onResizeHandler, false);
		}
		reload(element) {
			const maxHeightPercent = 0.7;
			const minDistance = 200;
			let height = Math.min(this.viewport.clientHeight * maxHeightPercent, element.clientHeight);
			height = Math.min(height, this.viewport.clientHeight - minDistance);
			this.root.style.height = height + 'px';
			element.style.top = '0px';
			this.content = {
				element,
				height
			};
		}
		onResize() {
			this.refresh();
		}
		onWheel(e) {
			e.stopPropagation();
			if (this.content) {
				const delta = e.deltaY > 0 ? -25 : 25;
				const scrollTop = this.getScrollTop();
				this.setScrollTop(scrollTop + delta);
			}
		}
		onTouchStart(e) {
			e.preventDefault();
			this.startScroll(readTouchPosition(e));
		}
		onMouseDown(e) {
			this.startScroll(readMousePosition(e));
		}
		onTouchMove(e) {
			e.preventDefault();
			this.moveScroll(readTouchPosition(e));
		}
		onMouseMove(e) {
			e.preventDefault();
			this.moveScroll(readMousePosition(e));
		}
		onTouchEnd(e) {
			e.preventDefault();
			this.stopScroll();
		}
		onMouseUp(e) {
			e.preventDefault();
			this.stopScroll();
		}
		startScroll(startPosition) {
			if (!this.scroll) {
				window.addEventListener('touchmove', this.onTouchMoveHandler, false);
				window.addEventListener('mousemove', this.onMouseMoveHandler, false);
				window.addEventListener('touchend', this.onTouchEndHandler, false);
				window.addEventListener('mouseup', this.onMouseUpHandler, false);
			}
			this.scroll = {
				startPositionY: startPosition.y,
				startScrollTop: this.getScrollTop()
			};
		}
		moveScroll(position) {
			if (this.scroll) {
				const delta = position.y - this.scroll.startPositionY;
				this.setScrollTop(this.scroll.startScrollTop + delta);
			}
		}
		stopScroll() {
			if (this.scroll) {
				window.removeEventListener('touchmove', this.onTouchMoveHandler, false);
				window.removeEventListener('mousemove', this.onMouseMoveHandler, false);
				window.removeEventListener('touchend', this.onTouchEndHandler, false);
				window.removeEventListener('mouseup', this.onMouseUpHandler, false);
				this.scroll = undefined;
			}
		}
		getScrollTop() {
			if (this.content && this.content.element.style.top) {
				return parseInt(this.content.element.style.top);
			}
			return 0;
		}
		setScrollTop(scrollTop) {
			if (this.content) {
				const max = this.content.element.clientHeight - this.content.height;
				const limited = Math.max(Math.min(scrollTop, 0), -max);
				this.content.element.style.top = limited + 'px';
			}
		}
	}

	var StepComponentState;
	(function (StepComponentState) {
		StepComponentState[(StepComponentState['default'] = 0)] = 'default';
		StepComponentState[(StepComponentState['selected'] = 1)] = 'selected';
		StepComponentState[(StepComponentState['dragging'] = 2)] = 'dragging';
	})(StepComponentState || (StepComponentState = {}));

	var ComponentType;
	(function (ComponentType) {
		ComponentType['task'] = 'task';
		ComponentType['switch'] = 'switch';
		ComponentType['container'] = 'container';
		// add stop component type
		ComponentType['stop'] = 'stop';
	})(ComponentType || (ComponentType = {}));

	class SequencePlaceholder {
		constructor(element, parentSequence, index) {
			this.element = element;
			this.parentSequence = parentSequence;
			this.index = index;
		}
		setIsHover(isHover) {
			Dom.toggleClass(this.element, isHover, 'sqd-hover');
		}
	}

	class JoinView {
		static createStraightJoin(parent, start, height) {
			const join = Dom.svg('line', {
				class: 'sqd-join',
				x1: start.x,
				y1: start.y,
				x2: start.x,
				y2: start.y + height
			});
			const g = Dom.svg('g');
			const circle = Dom.svg('circle', {
				class: 'sqd-start-stop',
				cx: SIZE / 2,
				cy: SIZE / 2,
				r: SIZE / 2
			});
			const stop = Dom.svg('rect', {
				class: 'sqd-start-stop-icon',
				x: start.x,
				y: start.y + height,
				width: SIZE * 0.5,
				height: SIZE * 0.5,
				rx: 4,
				ry: 4
			});
			g.appendChild(circle);
			g.appendChild(stop);
			//Dom.translate(g, start.x, start.y + height);
			join.appendChild(g);
			//console.log(join);
			parent.insertBefore(join, parent.firstChild);
		}
		static createJoins(parent, start, targets) {
			for (const target of targets) {
				const c = Math.abs(start.y - target.y) / 2; // size of a corner
				const l = Math.abs(start.x - target.x) - c * 2; // size of the line between corners
				const x = start.x > target.x ? -1 : 1;
				const y = start.y > target.y ? -1 : 1;
				const join = Dom.svg('path', {
					class: 'sqd-join',
					fill: 'none',
					d: `M ${start.x} ${start.y} q ${x * c * 0.3} ${y * c * 0.8} ${x * c} ${y * c} l ${x * l} 0 q ${x * c * 0.7} ${
						y * c * 0.2
					} ${x * c} ${y * c}`
				});
				parent.insertBefore(join, parent.firstChild);
			}
		}
	}

	function addStop(start) {
		const s = SIZE * 0.5;
		const m = (SIZE - s) / 2;
		const join = Dom.svg('line', {
			class: 'sqd-join',
			x1: start.x,
			y1: start.y,
			x2: start.x,
			y2: start.y + 24
		});
		const circle = Dom.svg('circle', {
			class: 'sqd-start-stop',
			cx: SIZE / 2,
			cy: SIZE / 2,
			r: SIZE / 2
		});
		const g = Dom.svg('g', {class: 'stop'});
		g.appendChild(join);
		g.appendChild(circle);

		const stop = Dom.svg('rect', {
			class: 'sqd-start-stop-icon',
			x: m,
			y: m,
			width: s,
			height: s,
			rx: 4,
			ry: 4
		});
		g.appendChild(stop);
		return g;
	}

	const PH_WIDTH = 100;
	const PH_HEIGHT = 24;
	class SequenceComponentView {
		constructor(g, width, height, joinX, placeholders, components) {
			this.g = g;
			this.width = width;
			this.height = height;
			this.joinX = joinX;
			this.placeholders = placeholders;
			this.components = components;
		}
		static create(parent, sequence, configuration) {
			const g = Dom.svg('g');
			parent.appendChild(g);
			const components = sequence.map(s => StepComponentFactory.create(g, s, sequence, configuration));
			const maxJoinX = components.length > 0 ? Math.max(...components.map(c => c.view.joinX)) : PH_WIDTH / 2;
			const maxWidth = components.length > 0 ? Math.max(...components.map(c => c.view.width)) : PH_WIDTH;
			let offsetY = PH_HEIGHT;
			const placeholders = [];
			for (let i = 0; i < components.length; i++) {
				const component = components[i];
				const offsetX = maxJoinX - component.view.joinX;
				JoinView.createStraightJoin(g, new Vector(maxJoinX, offsetY - PH_HEIGHT), PH_HEIGHT);
				placeholders.push(appendPlaceholder(g, maxJoinX - PH_WIDTH / 2, offsetY - PH_HEIGHT));
				Dom.translate(component.view.g, offsetX, offsetY);
				offsetY += component.view.height + PH_HEIGHT;
			}
			//console.log(parent);
			// empty canvas
			if (components.length == 0) {
				// console.log('empty canvas');
				// JoinView.createStraightJoin(g, new Vector(maxJoinX, 0), PH_HEIGHT);
				placeholders.push(appendPlaceholder(g, maxJoinX - PH_WIDTH / 2, 0));
			}
			// If making a if/else block
			for (let i = 0; i < components.length; i++) {
				if (components[i] instanceof SwitchStepComponent) {
					JoinView.createStraightJoin(g, new Vector(maxJoinX, 0), PH_HEIGHT);
					placeholders.push(appendPlaceholder(g, maxJoinX - PH_WIDTH / 2, 0));

					// Remove extra placeholders at last
					if (placeholders.length >= 3) {
						for (let k = 0; k < components.length; k++) {
							placeholders.splice(-1, 1);
						}
					}

					// Remove extra stop signs
					for (let k = 0; k < i; k++) {
						// console.log("removing ");
						// console.log(i-k);
						// console.log(document.getElementsByClassName('stop'));
						let length = document.getElementsByClassName('stop').length;
						document.getElementsByClassName('stop')[length - 1].parentNode.removeChild(document.getElementsByClassName('stop')[length - 1]);
					}
					
					// Automatically move the block below if/else to the end of true branch
					/* console.log(components[i].parentSequence[0]);
					console.log(components);
					let l = components.length;
					if (components[i + 1]) {
						// console.log(components[i+1].view.joinX);
						// console.log(components[i+1].view.width);
						for (let j = i + 1; j < l; j++) {
							console.log(l - j);
							console.log('block exists');
							components[i].step.branches.true.push(components[j]);
							components[i].parentSequence.splice(j, 1);
							components.splice(j, 1);
						}

						//console.log(components[i].step.branches.true);
						console.log(components[i].parentSequence);
						console.log(components);
						console.log(components[i].step.branches.true);
					} */
				} else {
					JoinView.createStraightJoin(g, new Vector(maxJoinX, offsetY - PH_HEIGHT), 0);
					placeholders.push(appendPlaceholder(g, maxJoinX - PH_WIDTH / 2, offsetY - PH_HEIGHT));
					// add stop sign to task block
					const stop = addStop(new Vector(maxJoinX - PH_WIDTH / 2, components[i].view.height - SIZE * 2));
					// calculate location
					Dom.translate(stop, maxJoinX - PH_WIDTH / 6.8, offsetY - PH_HEIGHT / 4);
					g.appendChild(stop);
				}
			}

			return new SequenceComponentView(g, maxWidth, offsetY, maxJoinX, placeholders, components);
		}
		getClientPosition() {
			throw new Error('Not supported');
		}
		setIsDragging(isDragging) {
			this.placeholders.forEach(p => {
				Dom.attrs(p, {
					visibility: isDragging ? 'visible' : 'hidden'
				});
			});
		}
	}
	function appendPlaceholder(g, x, y) {
		const rect = Dom.svg('rect', {
			class: 'sqd-placeholder',
			width: PH_WIDTH,
			height: PH_HEIGHT,
			x,
			y,
			rx: 6,
			ry: 6,
			visibility: 'hidden'
		});
		g.appendChild(rect);
		return rect;
	}

	class SequenceComponent {
		constructor(view, sequence) {
			this.view = view;
			this.sequence = sequence;
		}
		static create(parent, sequence, configuration) {
			const view = SequenceComponentView.create(parent, sequence, configuration);
			return new SequenceComponent(view, sequence);
		}
		findByElement(element) {
			for (const component of this.view.components) {
				const sc = component.findByElement(element);
				if (sc) {
					return sc;
				}
			}
			return null;
		}
		findById(stepId) {
			for (const component of this.view.components) {
				const sc = component.findById(stepId);
				if (sc) {
					return sc;
				}
			}
			return null;
		}
		getPlaceholders(result) {
			this.view.placeholders.forEach((ph, index) => {
				result.push(new SequencePlaceholder(ph, this.sequence, index));
			});
			this.view.components.forEach(c => c.getPlaceholders(result));
		}
		setIsDragging(isDragging) {
			this.view.setIsDragging(isDragging);
			this.view.components.forEach(c => c.setIsDragging(isDragging));
		}
		validate() {
			let isValid = true;
			for (const component of this.view.components) {
				isValid = component.validate() && isValid;
			}
			return isValid;
		}
	}

	const RECT_INPUT_SIZE = 18;
	const RECT_INPUT_ICON_SIZE = 14;
	const ROUND_INPUT_SIZE = 7;
	class InputView {
		constructor(root) {
			this.root = root;
		}
		static createRectInput(parent, x, y, iconUrl) {
			const g = Dom.svg('g');
			parent.appendChild(g);
			const rect = Dom.svg('rect', {
				class: 'sqd-input',
				width: RECT_INPUT_SIZE,
				height: RECT_INPUT_SIZE,
				x: x - RECT_INPUT_SIZE / 2,
				y: y + RECT_INPUT_SIZE / -2 + 0.5,
				rx: 4,
				ry: 4
			});
			g.appendChild(rect);
			if (iconUrl) {
				const icon = Dom.svg('image', {
					href: iconUrl,
					width: RECT_INPUT_ICON_SIZE,
					height: RECT_INPUT_ICON_SIZE,
					x: x - RECT_INPUT_ICON_SIZE / 2,
					y: y + RECT_INPUT_ICON_SIZE / -2
				});
				g.appendChild(icon);
			}
			return new InputView(g);
		}
		static createRoundInput(parent, x, y) {
			const circle = Dom.svg('circle', {
				class: 'sqd-input',
				cx: x,
				xy: y,
				r: ROUND_INPUT_SIZE
			});
			parent.appendChild(circle);
			return new InputView(circle);
		}
		setIsHidden(isHidden) {
			Dom.attrs(this.root, {
				visibility: isHidden ? 'hidden' : 'visible'
			});
		}
	}

	const LABEL_HEIGHT$2 = 22;
	const LABEL_PADDING_X = 10;
	const MIN_LABEL_WIDTH = 50;
	class LabelView {
		static create(parent, x, y, text, theme) {
			const nameText = Dom.svg('text', {
				class: 'sqd-label-text',
				x,
				y: y + LABEL_HEIGHT$2 / 2
			});
			nameText.textContent = text;
			parent.appendChild(nameText);
			const nameWidth = Math.max(nameText.getBBox().width + LABEL_PADDING_X * 2, MIN_LABEL_WIDTH);
			const nameRect = Dom.svg('rect', {
				class: 'sqd-label-rect',
				width: nameWidth,
				height: LABEL_HEIGHT$2,
				x: x - nameWidth / 2,
				y,
				rx: 10,
				ry: 10
			});
			if (theme) {
				nameRect.classList.add(`sqd-label-${theme}`);
			}
			parent.insertBefore(nameRect, nameText);
		}
	}

	class RegionView {
		constructor(regions) {
			this.regions = regions;
		}
		static create(parent, widths, height) {
			const totalWidth = widths.reduce((c, v) => c + v, 0);
			const mainRegion = Dom.svg('rect', {
				class: 'sqd-region',
				width: totalWidth,
				height,
				fill: 'transparent',
				rx: 5,
				ry: 5
			});
			const regions = [mainRegion];
			parent.insertBefore(mainRegion, parent.firstChild);
			let offsetX = widths[0];
			for (let i = 1; i < widths.length; i++) {
				const line = Dom.svg('line', {
					class: 'sqd-region',
					x1: offsetX,
					y1: 0,
					x2: offsetX,
					y2: height
				});
				regions.push(line);
				parent.insertBefore(line, parent.firstChild);
				offsetX += widths[i];
			}
			return new RegionView(regions);
		}
		getClientPosition() {
			const rect = this.regions[0].getBoundingClientRect();
			return new Vector(rect.x, rect.y);
		}
		setIsSelected(isSelected) {
			this.regions.forEach(region => {
				Dom.toggleClass(region, isSelected, 'sqd-selected');
			});
		}
	}

	const SIZE$1 = 20;
	class ValidationErrorView {
		constructor(g) {
			this.g = g;
		}
		static create(parent, x, y) {
			const g = Dom.svg('g', {
				class: 'sqd-hidden'
			});
			Dom.translate(g, x, y);
			const circle = Dom.svg('path', {
				class: 'sqd-validation-error',
				d: `M 0 ${-SIZE$1 / 2} l ${SIZE$1 / 2} ${SIZE$1} l ${-SIZE$1} 0 Z`
			});
			g.appendChild(circle);
			parent.appendChild(g);
			return new ValidationErrorView(g);
		}
		setIsHidden(isHidden) {
			Dom.toggleClass(this.g, isHidden, 'sqd-hidden');
		}
	}

	// Loop Component
	/*
	const PADDING_TOP$1 = 20;
	const PADDING_X$2 = 20;
	const LABEL_HEIGHT$1 = 22;
	class ContainerStepComponentView {
		constructor(g, width, height, joinX, sequenceComponent, inputView, regionView, validationErrorView) {
			this.g = g;
			this.width = width;
			this.height = height;
			this.joinX = joinX;
			this.sequenceComponent = sequenceComponent;
			this.inputView = inputView;
			this.regionView = regionView;
			this.validationErrorView = validationErrorView;
		}
		static create(parent, step, configuration) {
			const g = Dom.svg('g', {
				class: `sqd-container-group sqd-type-${step.type}`
			});
			parent.appendChild(g);
			const sequenceComponent = SequenceComponent.create(g, step.sequence, configuration);
			Dom.translate(sequenceComponent.view.g, PADDING_X$2, PADDING_TOP$1 + LABEL_HEIGHT$1);
			const width = sequenceComponent.view.width + PADDING_X$2 * 2;
			const height = sequenceComponent.view.height + PADDING_TOP$1 + LABEL_HEIGHT$1;
			const joinX = sequenceComponent.view.joinX + PADDING_X$2;
			LabelView.create(g, joinX, PADDING_TOP$1, step.name);
			const iconUrl = configuration.iconUrlProvider ? configuration.iconUrlProvider(step.componentType, step.type) : null;
			const inputView = InputView.createRectInput(g, joinX, 0, iconUrl);
			JoinView.createStraightJoin(g, new Vector(joinX, 0), PADDING_TOP$1);
			const regionView = RegionView.create(g, [width], height);
			const validationErrorView = ValidationErrorView.create(g, width, 0);
			return new ContainerStepComponentView(g, width, height, joinX, sequenceComponent, inputView, regionView, validationErrorView);
		}
		getClientPosition() {
			return this.regionView.getClientPosition();
		}
		containsElement(element) {
			return this.g.contains(element);
		}
		setIsDragging(isDragging) {
			this.inputView.setIsHidden(isDragging);
			this.sequenceComponent.setIsDragging(isDragging);
		}
		setIsSelected(isSelected) {
			this.regionView.setIsSelected(isSelected);
		}
		setIsDisabled(isDisabled) {
			Dom.toggleClass(this.g, isDisabled, 'sqd-disabled');
		}
		setIsValid(isHidden) {
			this.validationErrorView.setIsHidden(isHidden);
		}
	}

	class ContainerStepComponent {
		constructor(view, step, parentSequence, configuration) {
			this.view = view;
			this.step = step;
			this.parentSequence = parentSequence;
			this.configuration = configuration;
			this.currentState = StepComponentState.default;
		}
		static create(parent, step, parentSequence, configuration) {
			const view = ContainerStepComponentView.create(parent, step, configuration);
			return new ContainerStepComponent(view, step, parentSequence, configuration);
		}
		findByElement(element) {
			const sc = this.view.sequenceComponent.findByElement(element);
			if (sc) {
				return sc;
			}
			if (this.view.containsElement(element)) {
				return this;
			}
			return null;
		}
		findById(stepId) {
			const sc = this.view.sequenceComponent.findById(stepId);
			if (sc) {
				return sc;
			}
			if (this.step.id === stepId) {
				return this;
			}
			return null;
		}
		getPlaceholders(result) {
			if (this.currentState !== StepComponentState.dragging) {
				this.view.sequenceComponent.getPlaceholders(result);
			}
		}
		setState(state) {
			this.currentState = state;
			switch (state) {
				case StepComponentState.default:
					this.view.setIsSelected(false);
					this.view.setIsDisabled(false);
					break;
				case StepComponentState.selected:
					this.view.setIsSelected(true);
					this.view.setIsDisabled(false);
					break;
				case StepComponentState.dragging:
					this.view.setIsSelected(false);
					this.view.setIsDisabled(true);
					break;
			}
		}
		setIsDragging(isDragging) {
			this.view.setIsDragging(isDragging);
		}
		validate() {
			const isValid = this.configuration.validator ? this.configuration.validator(this.step) : true;
			this.view.setIsValid(isValid);
			const isSequenceValid = this.view.sequenceComponent.validate();
			return isValid && isSequenceValid;
		}
	}
*/
	// if-else block
	const MIN_CHILDREN_WIDTH = 50;
	const PADDING_X$1 = 20;
	const PADDING_TOP = 20;
	const LABEL_HEIGHT = 22;
	const CONNECTION_HEIGHT = 16;
	class SwitchStepComponentView {
		constructor(g, width, height, joinX, sequenceComponents, regionView, inputView, validationErrorView) {
			this.g = g;
			this.width = width;
			this.height = height;
			this.joinX = joinX;
			this.sequenceComponents = sequenceComponents;
			this.regionView = regionView;
			this.inputView = inputView;
			this.validationErrorView = validationErrorView;
		}
		static create(parent, step, configuration) {
			const g = Dom.svg('g', {
				class: `sqd-switch-group sqd-type-${step.type}`,
				id: 'if'
			});
			parent.appendChild(g);
			const branchNames = Object.keys(step.branches);
			const sequenceComponents = branchNames.map(bn => SequenceComponent.create(g, step.branches[bn], configuration));
			const maxChildHeight = Math.max(...sequenceComponents.map(s => s.view.height));
			const containerWidths = sequenceComponents.map(s => Math.max(s.view.width, MIN_CHILDREN_WIDTH) + PADDING_X$1 * 2);
			const containersWidth = containerWidths.reduce((p, c) => p + c, 0);
			const containerHeight = maxChildHeight + PADDING_TOP + LABEL_HEIGHT * 2 + CONNECTION_HEIGHT * 2;
			const containerOffsets = [];
			const joinXs = sequenceComponents.map(s => Math.max(s.view.joinX, MIN_CHILDREN_WIDTH / 2));
			let totalX = 0;
			for (let i = 0; i < branchNames.length; i++) {
				containerOffsets.push(totalX);
				totalX += containerWidths[i];
			}
			branchNames.forEach((branchName, i) => {
				const sequence = sequenceComponents[i];
				const offsetX = containerOffsets[i];
				LabelView.create(
					g,
					offsetX + joinXs[i] + PADDING_X$1,
					PADDING_TOP + LABEL_HEIGHT + CONNECTION_HEIGHT,
					branchName,
					'secondary'
				);

				const childEndY = PADDING_TOP + LABEL_HEIGHT * 2 + CONNECTION_HEIGHT + sequence.view.height;
				const fillingHeight = containerHeight - childEndY - CONNECTION_HEIGHT;
				// if (fillingHeight > 0) {
				//     JoinView.createStraightJoin(g, new Vector(containerOffsets[i] + joinXs[i] + PADDING_X$1, childEndY), fillingHeight);
				// }
				const sequenceX = offsetX + PADDING_X$1 + Math.max((MIN_CHILDREN_WIDTH - sequence.view.width) / 2, 0);
				const sequenceY = PADDING_TOP + LABEL_HEIGHT * 2 + CONNECTION_HEIGHT;
				JoinView.createStraightJoin(
					g,
					new Vector(containerOffsets[i] + joinXs[i] + PADDING_X$1, PADDING_TOP + LABEL_HEIGHT * 2 + CONNECTION_HEIGHT),
					PH_HEIGHT
				);
				Dom.translate(sequence.view.g, sequenceX, sequenceY);
			});
			LabelView.create(g, containerWidths[0], PADDING_TOP, step.name);
			JoinView.createStraightJoin(g, new Vector(containerWidths[0], 0), PADDING_TOP);
			const iconUrl = configuration.iconUrlProvider ? configuration.iconUrlProvider(step.componentType, step.type) : null;
			const inputView = InputView.createRectInput(g, containerWidths[0], 0, iconUrl);
			JoinView.createJoins(
				g,
				new Vector(containerWidths[0], PADDING_TOP + LABEL_HEIGHT),
				containerOffsets.map((o, i) => new Vector(o + joinXs[i] + PADDING_X$1, PADDING_TOP + LABEL_HEIGHT + CONNECTION_HEIGHT))
			);
			//JoinView.createJoins(g, new Vector(containerWidths[0], containerHeight), containerOffsets.map((o, i) => new Vector(o + joinXs[i] + PADDING_X$1, PADDING_TOP + CONNECTION_HEIGHT + LABEL_HEIGHT * 2 + maxChildHeight)));
			const regionView = RegionView.create(g, containerWidths, containerHeight);
			const validationErrorView = ValidationErrorView.create(g, containersWidth, 0);
			return new SwitchStepComponentView(
				g,
				containersWidth,
				containerHeight,
				containerWidths[0],
				sequenceComponents,
				regionView,
				inputView,
				validationErrorView
			);
		}
		getClientPosition() {
			return this.regionView.getClientPosition();
		}
		containsElement(element) {
			return this.g.contains(element);
		}
		setIsDragging(isDragging) {
			this.inputView.setIsHidden(isDragging);
		}
		setIsSelected(isSelected) {
			this.regionView.setIsSelected(isSelected);
		}
		setIsDisabled(isDisabled) {
			Dom.toggleClass(this.g, isDisabled, 'sqd-disabled');
		}
		setIsValid(isValid) {
			this.validationErrorView.setIsHidden(isValid);
		}
	}

	class SwitchStepComponent {
		constructor(view, step, parentSequence, configuration) {
			this.view = view;
			this.step = step;
			this.parentSequence = parentSequence;
			this.configuration = configuration;
			this.currentState = StepComponentState.default;
		}
		static create(parent, step, parentSequence, configuration) {
			const view = SwitchStepComponentView.create(parent, step, configuration);
			return new SwitchStepComponent(view, step, parentSequence, configuration);
		}
		findByElement(element) {
			for (const sequence of this.view.sequenceComponents) {
				const sc = sequence.findByElement(element);
				if (sc) {
					return sc;
				}
			}
			if (this.view.containsElement(element)) {
				return this;
			}
			return null;
		}
		findById(stepId) {
			if (this.step.id === stepId) {
				return this;
			}
			for (const sequence of this.view.sequenceComponents) {
				const sc = sequence.findById(stepId);
				if (sc) {
					return sc;
				}
			}
			return null;
		}
		// 添加branch上的placeholder
		getPlaceholders(result) {
			if (this.currentState !== StepComponentState.dragging) {
				this.view.sequenceComponents.forEach(sc => sc.getPlaceholders(result));
			}
		}
		setIsDragging(isDragging) {
			if (this.currentState !== StepComponentState.dragging) {
				this.view.sequenceComponents.forEach(s => s.setIsDragging(isDragging));
			}
			this.view.setIsDragging(isDragging);
		}
		setState(state) {
			this.currentState = state;
			switch (state) {
				case StepComponentState.default:
					this.view.setIsSelected(false);
					this.view.setIsDisabled(false);
					break;
				case StepComponentState.selected:
					this.view.setIsSelected(true);
					this.view.setIsDisabled(false);
					break;
				case StepComponentState.dragging:
					this.view.setIsSelected(false);
					this.view.setIsDisabled(true);
					break;
			}
		}
		validate() {
			const isValid = this.configuration.validator ? this.configuration.validator(this.step) : true;
			this.view.setIsValid(isValid);
			let areChildrenValid = true;
			for (const component of this.view.sequenceComponents) {
				areChildrenValid = component.validate() && areChildrenValid;
			}
			return isValid && areChildrenValid;
		}
	}

	const OUTPUT_SIZE = 5;
	class OutputView {
		constructor(root) {
			this.root = root;
		}
		static create(parent, x, y) {
			const circle = Dom.svg('circle', {
				class: 'sqd-output',
				cx: x,
				cy: y,
				r: OUTPUT_SIZE
			});
			parent.appendChild(circle);
			return new OutputView(circle);
		}
		setIsHidden(isHidden) {
			Dom.attrs(this.root, {
				visibility: isHidden ? 'hidden' : 'visible'
			});
		}
	}

	const PADDING_X = 12;
	const PADDING_Y = 10;
	const MIN_TEXT_WIDTH = 70;
	const ICON_SIZE = 22;
	const RECT_RADIUS = 5;
	class TaskStepComponentView {
		constructor(g, width, height, joinX, rect, inputView, outputView, validationErrorView, icon1, icon2, icon3) {
			this.icon1 = icon1;
			this.icon2 = icon2;
			this.icon3 = icon3;
			this.g = g;
			this.width = width;
			this.height = height;
			this.joinX = joinX;
			this.rect = rect;
			this.inputView = inputView;
			this.outputView = outputView;
			this.validationErrorView = validationErrorView;
		}
		static create(parent, step, configuration) {
			const g = Dom.svg('g', {
				class: `sqd-task-group sqd-type-${step.type}` // task item
			});
			parent.appendChild(g);
			const boxHeight = ICON_SIZE + PADDING_Y * 2;
			const text = Dom.svg('text', {
				x: ICON_SIZE + PADDING_X * 2,
				y: boxHeight / 2,
				class: 'sqd-task-text'
			});
			text.textContent = step.name;
			g.appendChild(text);
			const textWidth = Math.max(text.getBBox().width, MIN_TEXT_WIDTH);
			const boxWidth =  2 * ICON_SIZE + 3 * PADDING_X  + textWidth;
			const rect = Dom.svg('rect', {
				x: 0.5,
				y: 0.5,
				class: 'sqd-task-rect',
				width: boxWidth,
				height: boxHeight,
				rx: RECT_RADIUS,
				ry: RECT_RADIUS
			});
			g.insertBefore(rect, text);
			// const text1 = Dom.svg('text', {
			// 	x: ICON_SIZE + PADDING_X * 2,
			// 	y: boxHeight / 2,
			// 	class: 'sqd-task-text'
			// });
			// text1.textContent = "Select List"
			
			const rect1 = Dom.svg('rect', {
				x: 0,
				y: boxHeight,
				class: 'sqd-task-rect-dropdown',
				width: boxWidth,
				height: 2 * boxHeight,
				rx: RECT_RADIUS,
				ry: RECT_RADIUS
			});
			Dom.attrs(rect1, {
				class: "sqd-hidden",
				id: `d${Date.now()}`
			});
			const iconUrl = configuration.iconUrlProvider ? configuration.iconUrlProvider(step.componentType, step.type) : null;
			// add click event for icon
			const icon = iconUrl
				? Dom.svg('image', {
						href: iconUrl
				  })
				: Dom.svg('rect', {
						class: 'sqd-task-empty-icon',
						rx: 4,
						ry: 4
				  });
			Dom.attrs(icon, {
				x: PADDING_X,
				y: PADDING_Y,
				width: ICON_SIZE,
				height: ICON_SIZE
			});
			const moreUrl = './assets/more.svg';
			const moreIcon = moreUrl
			 	? Dom.svg('image', {
			 		href: moreUrl,
		  	 	})
			 	: Dom.svg('rect', {
			 			class: 'sqd-task-empty-icon',
			 			rx: 4,
			 			ry: 4
		  	 	});
				 Dom.attrs(moreIcon, {
					class: 'more',
					id: Date.now(),
					x: ICON_SIZE + 3 * PADDING_X + textWidth - 10,
					y: PADDING_Y,
					width: ICON_SIZE,
					height: ICON_SIZE
				 });
			 	const iconUrl1 = configuration.iconUrlProvider ? configuration.iconUrlProvider(step.componentType, step.type) : null;
			// // add click event for icon
			 	const icon1 = iconUrl1
			 	? Dom.svg('image', {
			 			href: iconUrl
			 	  })
			 	: Dom.svg('rect', {
			 			class: 'sqd-task-empty-icon',
			 			rx: 4,
		 			ry: 4
			 	  });
			 Dom.attrs(icon1, {
			 	class: "moreicon sqd-hidden",
			 	x: ICON_SIZE + 3 * PADDING_X + textWidth + 44,
			 	y: PADDING_Y,
			 	width: ICON_SIZE,
			 	height: ICON_SIZE
			 });
			const iconUrl2 = configuration.iconUrlProvider ? configuration.iconUrlProvider(step.componentType, step.type) : null;
			// add click event for icon
			const icon2 = iconUrl2
				? Dom.svg('image', {
						href: iconUrl
				  })
				: Dom.svg('rect', {
						class: 'sqd-task-empty-icon',
						rx: 4,
						ry: 4
				  });
			Dom.attrs(icon2, {
				class: "moreicon sqd-hidden",
				x: ICON_SIZE + 3 * PADDING_X + textWidth + 22,
				y: PADDING_Y + 22,
				width: ICON_SIZE,
				height: ICON_SIZE
			});
			const iconUrl3 = configuration.iconUrlProvider ? configuration.iconUrlProvider(step.componentType, step.type) : null;
			// add click event for icon
			const icon3 = iconUrl3
				? Dom.svg('image', {
						href: iconUrl
				  })
				: Dom.svg('rect', {
						class: 'sqd-task-empty-icon',
						rx: 4,
						ry: 4
				  });
			Dom.attrs(icon3, {
				class: "moreicon sqd-hidden",
				id: `p${Date.now()}`,
				x: ICON_SIZE + 3 * PADDING_X + textWidth + 22,
				y: PADDING_Y - 22,
				width: ICON_SIZE,
				height: ICON_SIZE
			});
			g.appendChild(icon);
			g.appendChild(moreIcon);
			//g.appendChild(moreUrl);
			//g.appendChild(moreButton);
			g.appendChild(icon1);
			g.appendChild(icon2);
			g.appendChild(icon3);
			g.appendChild(rect1);
			const inputView = InputView.createRoundInput(g, boxWidth / 2, 0);
			const outputView = OutputView.create(g, boxWidth / 2, boxHeight);
			const validationErrorView = ValidationErrorView.create(g, boxWidth, 0);
			return new TaskStepComponentView(g, boxWidth, boxHeight, boxWidth / 2, rect, inputView, outputView, validationErrorView, icon1, icon2, icon3);
		}
		getClientPosition() {
			const rect = this.rect.getBoundingClientRect();
			return new Vector(rect.x, rect.y);
		}
		containsElement(element) {
			return this.g.contains(element);
		}
		setIsDragging(isDragging) {
			this.inputView.setIsHidden(isDragging);
			this.outputView.setIsHidden(isDragging);
		}
		setIsDisabled(isDisabled) {
			Dom.toggleClass(this.g, isDisabled, 'sqd-disabled');
		}
		setIsSelected(isSelected) {
			Dom.toggleClass(this.rect, isSelected, 'sqd-selected');
		}
		setIsValid(isValid) {
			this.validationErrorView.setIsHidden(isValid);
		}
	}
	class TaskStepComponent { // take one Subscribe as example
		constructor(view, step, parentSequence, configuration) {
			this.view = view;
			this.step = step;
			this.parentSequence = parentSequence;
			this.configuration = configuration;
		}
		static create(parent, step, parentSequence, configuration) {
			const view = TaskStepComponentView.create(parent, step, configuration);
			return new TaskStepComponent(view, step, parentSequence, configuration);
		}
		findByElement(element) {
			return this.view.containsElement(element) ? this : null;
		}
		findById(stepId) {
			return this.step.id === stepId ? this : null;
		}
		getPlaceholders() {
			// Nothing to do here.
		}
		setIsDragging(isDragging) {
			this.view.setIsDragging(isDragging);
		}
		setState(state) {
			switch (state) {
				case StepComponentState.default:
					this.view.setIsSelected(false);
					this.view.setIsDisabled(false);
					break;
				case StepComponentState.selected:
					this.view.setIsDisabled(false);
					this.view.setIsSelected(true);
					break;
				case StepComponentState.dragging:
					this.view.setIsDisabled(true);
					this.view.setIsSelected(false);
					break;
			}
		}
		validate() {
			const isValid = this.configuration.validator ? this.configuration.validator(this.step) : true;
			this.view.setIsValid(isValid);
			return isValid;
		}
	}

	class StepComponentFactory {
		static create(parent, step, parentSequence, configuration) {
			switch (step.componentType) {
				case ComponentType.task:
					return TaskStepComponent.create(parent, step, parentSequence, configuration);
				case ComponentType.switch:
					return SwitchStepComponent.create(parent, step, parentSequence, configuration);
				case ComponentType.container:
					return ContainerStepComponent.create(parent, step, parentSequence, configuration);
				default:
					throw new Error(`Unknown component type: ${step.componentType}`);
			}
		}
	}

	const SAFE_OFFSET = 10;
	class DragStepView {
		constructor(width, height, layer) {
			this.width = width;
			this.height = height;
			this.layer = layer;
		}
		static create(step, configuration) {
			const theme = configuration.theme || 'light';
			const layer = Dom.element('div', {
				class: `sqd-drag sqd-theme-${theme}`
			});
			document.body.appendChild(layer);
			const canvas = Dom.svg('svg');
			layer.appendChild(canvas);
			const fakeSequence = [];
			const stepComponent = StepComponentFactory.create(canvas, step, fakeSequence, configuration.steps);
			Dom.attrs(canvas, {
				width: stepComponent.view.width + SAFE_OFFSET * 2,
				height: stepComponent.view.height + SAFE_OFFSET * 2
			});
			Dom.translate(stepComponent.view.g, SAFE_OFFSET, SAFE_OFFSET);
			return new DragStepView(stepComponent.view.width, stepComponent.view.height, layer);
		}
		setPosition(position) {
			this.layer.style.top = position.y - SAFE_OFFSET + 'px';
			this.layer.style.left = position.x - SAFE_OFFSET + 'px';
		}
		remove() {
			document.body.removeChild(this.layer);
		}
	}

	class PlaceholderFinder {
		constructor(placeholders, context) {
			this.placeholders = placeholders;
			this.context = context;
			this.clearCacheHandler = () => this.clearCache();
		}
		static create(placeholders, context) {
			const checker = new PlaceholderFinder(placeholders, context);
			context.onViewPortChanged.subscribe(checker.clearCacheHandler);
			window.addEventListener('scroll', checker.clearCacheHandler, false);
			return checker;
		}
		find(vLt, vWidth, vHeight) {
			var _a;
			if (!this.cache) {
				this.cache = this.placeholders.map(placeholder => {
					const rect = placeholder.element.getBoundingClientRect();
					return {
						placeholder,
						lt: new Vector(rect.x, rect.y),
						br: new Vector(rect.x + rect.width, rect.y + rect.height)
					};
				});
				this.cache.sort((a, b) => a.lt.y - b.lt.y);
			}
			const vR = vLt.x + vWidth;
			const vB = vLt.y + vHeight;
			return (_a = this.cache.find(p => {
				return Math.max(vLt.x, p.lt.x) < Math.min(vR, p.br.x) && Math.max(vLt.y, p.lt.y) < Math.min(vB, p.br.y);
			})) === null || _a === void 0
				? void 0
				: _a.placeholder;
		}
		destroy() {
			this.context.onViewPortChanged.unsubscribe(this.clearCacheHandler);
			window.removeEventListener('scroll', this.clearCacheHandler, false);
		}
		clearCache() {
			this.cache = undefined;
		}
	}

	class DragStepBehavior {
		constructor(view, context, step, movingStepComponent) {
			this.view = view;
			this.context = context;
			this.step = step;
			this.movingStepComponent = movingStepComponent;
		}
		static create(context, step, movingStepComponent) {
			const view = DragStepView.create(step, context.configuration);
			return new DragStepBehavior(view, context, step, movingStepComponent);
		}
		onStart(position) {
			let offset;
			if (this.movingStepComponent) {
				this.movingStepComponent.setState(StepComponentState.dragging);
				const clientPosition = this.movingStepComponent.view.getClientPosition();
				offset = position.subtract(clientPosition);
			} else {
				offset = new Vector(this.view.width / 2, this.view.height / 2);
			}
			this.view.setPosition(position.subtract(offset));
			this.context.setIsDragging(true);
			this.state = {
				startPosition: position,
				finder: PlaceholderFinder.create(this.context.getPlaceholders(), this.context),
				offset
			};
		}
		onMove(delta) {
			//if (this.movingStepComponent instanceof SwitchStepComponent) {
			//console.log(this.context);
			//}
			if (this.state) {
				const newPosition = this.state.startPosition.subtract(delta).subtract(this.state.offset);
				this.view.setPosition(newPosition);
				const placeholder = this.state.finder.find(newPosition, this.view.width, this.view.height);
				if (this.currentPlaceholder !== placeholder) {
					if (this.currentPlaceholder) {
						this.currentPlaceholder.setIsHover(false);
					}
					if (placeholder) {
						placeholder.setIsHover(true);
					}
					this.currentPlaceholder = placeholder;
				}
			}
		}
		onEnd(interrupt) {
			if (!this.state) {
				throw new Error('Invalid state');
			}

			this.state.finder.destroy();
			this.state = undefined;
			this.view.remove();
			this.context.setIsDragging(false);
			let modified = false;

			if (!interrupt && this.currentPlaceholder) {
				if (this.movingStepComponent) {
					modified = this.context.tryMoveStep(
						this.movingStepComponent.parentSequence,
						this.movingStepComponent.step,
						this.currentPlaceholder.parentSequence,
						this.currentPlaceholder.index
					);
				} else {
					modified = this.context.tryInsertStep(this.step, this.currentPlaceholder.parentSequence, this.currentPlaceholder.index);
				}
			}
			if (!modified) {
				if (this.movingStepComponent) {
					this.movingStepComponent.setState(StepComponentState.default);
				}
				if (this.currentPlaceholder) {
					this.currentPlaceholder.setIsHover(false);
				}
			}

			/*
			if (this.context.selectedStep.componentType == "switch") {
				console.log(this.context.selectedStep);
				//console.log(this.context.provider);
			}
			console.log(this.context.provider);
			const g = Dom.svg('g');
			const stop = addStop(this.context.provider.context.viewPort.position);
			g.appendChild(stop);
			
			Dom.translate(g, this.context.provider.context.viewPort.position.x, SIZE);
			console.log(g);
			this.context.provider.view.canvas.appendChild(g);
*/

			this.currentPlaceholder = undefined;
		}
	}
	/* not used
	// DFS to find all the way down & add a stop component
	function addStop(stop, component) {
		// base case: not a switch component || one of the branch has no component 
		if (component instanceof TaskComponent) {
			
		}
	}
*/
	const regexp = /^[a-zA-Z][a-zA-Z0-9_-]+$/;
	class TypeValidator {
		static validate(type) {
			if (!regexp.test(type)) {
				throw new Error(`Step type "${type}" contains not allowed characters`);
			}
		}
	}

	class Uid {
		static next() {
			const bytes = new Uint8Array(16);
			window.crypto.getRandomValues(bytes);
			return Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('');
		}
	}

	class ToolboxItemView {
		constructor(root) {
			this.root = root;
		}
		static create(parent, step, configuration) {
			const root = Dom.element('div', {
				class: `sqd-toolbox-item sqd-type-${step.type}`,
				title: step.name
			});
			const iconUrl = configuration.iconUrlProvider ? configuration.iconUrlProvider(step.componentType, step.type) : null;
			const icon = Dom.element('div', {
				class: 'sqd-toolbox-item-icon'
			});
			if (iconUrl) {
				const iconImage = Dom.element('img', {
					class: 'sqd-toolbox-item-icon-image',
					src: iconUrl
				});
				icon.appendChild(iconImage);
			} else {
				icon.classList.add('sqd-no-icon');
			}
			const text = Dom.element('div', {
				class: 'sqd-toolbox-item-text'
			});
			text.textContent = step.name;
			root.appendChild(icon);
			root.appendChild(text);
			parent.appendChild(root);
			return new ToolboxItemView(root);
		}
		bindMousedown(handler) {
			this.root.addEventListener('mousedown', handler, false);
		}
		bindTouchstart(handler) {
			this.root.addEventListener('touchstart', handler, false);
		}
		bindContextMenu(handler) {
			this.root.addEventListener('contextmenu', handler, false);
		}
	}

	class ToolboxItem {
		constructor(step, context) {
			this.step = step;
			this.context = context;
		}
		static create(parent, step, context) {
			TypeValidator.validate(step.type);
			const view = ToolboxItemView.create(parent, step, context.configuration.steps);
			const item = new ToolboxItem(step, context);
			view.bindMousedown(e => item.onMousedown(e));
			view.bindTouchstart(e => item.onTouchstart(e));
			view.bindContextMenu(e => item.onContextMenu(e));
			return item;
		}
		onTouchstart(e) {
			e.preventDefault();
			if (e.touches.length === 1) {
				e.stopPropagation();
				this.startDrag(readTouchPosition(e));
			}
		}
		onMousedown(e) {
			e.stopPropagation();
			const isPrimaryButton = e.button === 0;
			if (isPrimaryButton) {
				this.startDrag(readMousePosition(e));
			}
		}
		onContextMenu(e) {
			e.preventDefault();
		}
		startDrag(position) {
			if (!this.context.isReadonly) {
				const newStep = createStep(this.step);
				this.context.behaviorController.start(position, DragStepBehavior.create(this.context, newStep));
			}
		}
	}
	function createStep(step) {
		const newStep = ObjectCloner.deepClone(step);
		newStep.id = Uid.next();
		return newStep;
	}

	class ToolboxView {
		constructor(header, headerToggleIcon, body, filterInput, scrollboxView, context) {
			this.header = header;
			this.headerToggleIcon = headerToggleIcon;
			this.body = body;
			this.filterInput = filterInput;
			this.scrollboxView = scrollboxView;
			this.context = context;
		}
		static create(parent, context) {
			const root = Dom.element('div', {
				class: 'sqd-toolbox'
			});
			const header = Dom.element('div', {
				class: 'sqd-toolbox-header'
			});
			const headerTitle = Dom.element('div', {
				class: 'sqd-toolbox-header-title'
			});
			headerTitle.innerText = 'Toolbox';
			const headerToggleIcon = Icons.create('sqd-toolbox-toggle-icon');
			const body = Dom.element('div', {
				class: 'sqd-toolbox-body'
			});
			const filterInput = Dom.element('input', {
				class: 'sqd-toolbox-filter',
				type: 'text',
				placeholder: 'Search...'
			});
			root.appendChild(header);
			root.appendChild(body);
			header.appendChild(headerTitle);
			header.appendChild(headerToggleIcon);
			body.appendChild(filterInput);
			parent.appendChild(root);
			const scrollboxView = ScrollBoxView.create(body, parent);
			return new ToolboxView(header, headerToggleIcon, body, filterInput, scrollboxView, context);
		}
		bindToggleIsCollapsedClick(handler) {
			function forward(e) {
				e.preventDefault();
				handler();
			}
			this.header.addEventListener('click', forward, false);
		}
		bindFilterInputChange(handler) {
			function forward(e) {
				handler(e.target.value);
			}
			this.filterInput.addEventListener('keyup', forward, false);
			this.filterInput.addEventListener('blur', forward, false);
		}
		setIsCollapsed(isCollapsed) {
			Dom.toggleClass(this.body, isCollapsed, 'sqd-hidden');
			this.headerToggleIcon.innerHTML = isCollapsed ? Icons.arrowDown : Icons.close;
			if (!isCollapsed) {
				this.scrollboxView.refresh();
			}
		}
		setGroups(groups) {
			const list = Dom.element('div');
			groups.forEach(group => {
				const groupTitle = Dom.element('div', {
					class: 'sqd-toolbox-group-title'
				});
				groupTitle.innerText = group.name;
				list.appendChild(groupTitle);
				group.steps.forEach(s => ToolboxItem.create(list, s, this.context));
			});
			this.scrollboxView.setContent(list);
		}
		destroy() {
			this.scrollboxView.destroy();
		}
	}

	class Toolbox {
		constructor(view, context) {
			this.view = view;
			this.context = context;
		}
		static create(parent, context) {
			const view = ToolboxView.create(parent, context);
			view.setIsCollapsed(context.isToolboxCollapsed);
			const toolbox = new Toolbox(view, context);
			toolbox.render();
			context.onIsToolboxCollapsedChanged.subscribe(ic => toolbox.onIsToolboxCollapsedChanged(ic));
			view.bindToggleIsCollapsedClick(() => toolbox.toggleIsCollapsedClick());
			view.bindFilterInputChange(v => toolbox.onFilterInputChanged(v));
			return toolbox;
		}
		destroy() {
			this.view.destroy();
		}
		render() {
			const groups = this.context.configuration.toolbox.groups
				.map(g => {
					return {
						name: g.name,
						steps: g.steps.filter(s => {
							return this.filter ? s.name.toLowerCase().includes(this.filter) : true;
						})
					};
				})
				.filter(g => g.steps.length > 0);
			this.view.setGroups(groups);
		}
		toggleIsCollapsedClick() {
			this.context.toggleIsToolboxCollapsed();
		}
		onIsToolboxCollapsedChanged(isCollapsed) {
			this.view.setIsCollapsed(isCollapsed);
		}
		onFilterInputChanged(value) {
			this.filter = value.toLowerCase();
			this.render();
		}
	}

	class MoveViewPortBehavior {
		constructor(startPosition, context) {
			this.startPosition = startPosition;
			this.context = context;
		}
		static create(context) {
			return new MoveViewPortBehavior(context.viewPort.position, context);
		}
		onStart() {
			this.context.setSelectedStep(null);
			//Dom.toggleClass(this.pressedStepComponent.view.icon2, this.context.isToolboxCollapsed, 'sqd-hidden');
			//Dom.toggleClass(this.pressedStepComponent.view.icon3, this.context.isToolboxCollapsed, 'sqd-hidden');
			
			console.log(2258, this.context)
		}
		onMove(delta) {
			const newPosition = this.startPosition.subtract(delta);
			this.context.setViewPort(newPosition, this.context.viewPort.scale);
		}
		onEnd() {
			// Nothing to do.
		}
	}

	class SelectStepBehavior {
		constructor(pressedStepComponent, context) {
			this.pressedStepComponent = pressedStepComponent;
			this.context = context;
		}
		static create(pressedStepComponent, context) {
			return new SelectStepBehavior(pressedStepComponent, context);
		}
		onStart() {
			// Nothing to do.
			//console.log(2121, this.context);
			this.context.openSmartEditor();
			//
			//Dom.toggleClass(this.pressedStepComponent.view.icon2, this.context.isToolboxCollapsed, 'sqd-hidden');
			//Dom.toggleClass(this.pressedStepComponent.view.icon3, this.context.isToolboxCollapsed, 'sqd-hidden');
			
		}
		onMove(delta) {
			if (!this.context.isReadonly && delta.distance() > 2) {
				this.context.setSelectedStep(null);
				return DragStepBehavior.create(this.context, this.pressedStepComponent.step, this.pressedStepComponent);
			}
		}
		onEnd(interrupt) {
			if (!interrupt) {
				this.context.setSelectedStep(this.pressedStepComponent.step);
			}
		}
	}

	function race(timeout, a, b) {
		const value = [undefined, undefined];
		const result = new SimpleEvent();
		let scheduled = false;
		function forward() {
			if (scheduled) {
				return;
			}
			scheduled = true;
			setTimeout(() => {
				try {
					result.forward(value);
				} finally {
					scheduled = false;
					value.fill(undefined);
				}
			}, timeout);
		}
		[a, b]
			.filter(e => e)
			.forEach((e, index) => {
				e.subscribe(v => {
					value[index] = v;
					forward();
				});
			});
		return result;
	}

	// start: start component
	const SIZE = 30;
	class StartComponentView {
		constructor(g, width, height, joinX, component) {
			this.g = g;
			this.width = width;
			this.height = height;
			this.joinX = joinX;
			this.component = component;
		}
		static create(parent, sequence, configuration) {
			const g = Dom.svg('g');
			parent.appendChild(g);
			const sequenceComponent = SequenceComponent.create(g, sequence, configuration);
			const view = sequenceComponent.view;
			const startCircle = createCircle(true);
			Dom.translate(startCircle, view.joinX - SIZE / 2, 0);
			g.appendChild(startCircle);
			Dom.translate(view.g, 0, SIZE);

			// const endCircle = createCircle(false);
			// Dom.translate(endCircle, view.joinX - SIZE / 2, SIZE + view.height);
			// g.appendChild(endCircle);
			return new StartComponentView(g, view.width, view.height + SIZE * 2, view.joinX, sequenceComponent);
		}
		getClientPosition() {
			throw new Error('Not supported');
		}
		destroy() {
			var _a;
			(_a = this.g.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(this.g);
		}
	}
	function createCircle(isStart) {
		const circle = Dom.svg('circle', {
			class: 'sqd-start-stop',
			cx: SIZE / 2,
			cy: SIZE / 2,
			r: SIZE / 2
		});
		const g = Dom.svg('g');
		g.appendChild(circle);
		const s = SIZE * 0.5;
		const m = (SIZE - s) / 2;
		if (isStart) {
			const start = Dom.svg('path', {
				class: 'sqd-start-stop-icon',
				transform: `translate(${m}, ${m})`,
				d: `M ${s * 0.2} 0 L ${s} ${s / 2} L ${s * 0.2} ${s} Z`
			});
			g.appendChild(start);
		} else {
			const stop = Dom.svg('rect', {
				class: 'sqd-start-stop-icon',
				x: m,
				y: m,
				width: s,
				height: s,
				rx: 4,
				ry: 4
			});
			g.appendChild(stop);
		}
		return g;
	}

	class StartComponent {
		constructor(view) {
			this.view = view;
		}
		static create(parent, sequence, configuration) {
			const view = StartComponentView.create(parent, sequence, configuration);
			return new StartComponent(view);
		}
		findByElement(element) {
			return this.view.component.findByElement(element);
		}
		findById(stepId) {
			return this.view.component.findById(stepId);
		}
		getPlaceholders(result) {
			this.view.component.getPlaceholders(result);
		}
		setIsDragging(isDragging) {
			this.view.component.setIsDragging(isDragging);
		}
		validate() {
			return this.view.component.validate();
		}
	}
	// end: Start component

	/* not used below
	// start: Stop component
	class StopComponentView {
		constructor(g, width, height, joinX, component) {
			this.g = g;
			this.width = width;
			this.height = height;
			this.joinX = joinX;
			this.component = component;
		}
		static create(parent, sequence, configuration) {
			const g = Dom.svg('g');
			parent.appendChild(g);
			const sequenceComponent = SequenceComponent.create(g, sequence, configuration);
			const view = sequenceComponent.view;

			const endCircle = createCircle(false);
			Dom.translate(endCircle, view.joinX - SIZE / 2, SIZE + view.height);
			g.appendChild(endCircle);
			return new StopComponentView(g, view.width, view.height + SIZE * 2, view.joinX, sequenceComponent);
		}
		getClientPosition() {
			throw new Error('Not supported');
		}
		destroy() {
			var _a;
			(_a = this.g.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(this.g);
		}
	}

	class StopComponent {
		constructor(view) {
			this.view = view;
			this.componentType = 'stop';
		}
		static create(parent, sequence, configuration) {
			const view = StopComponentView.create(parent, sequence, configuration);
			return new StopComponent(view);
		}
		findByElement(element) {
			return this.view.component.findByElement(element);
		}
		findById(stepId) {
			return this.view.component.findById(stepId);
		}
		getPlaceholders(result) {
			this.view.component.getPlaceholders(result);
		}
		setIsDragging(isDragging) {
			this.view.component.setIsDragging(isDragging);
		}
		validate() {
			return this.view.component.validate();
		}
	}
	// end: Stop component
*/
	const GRID_SIZE = 48;
	let lastGridPatternId = 0;
	class WorkspaceView {
		constructor(context, workspace, canvas, gridPattern, gridPatternPath, foreground, configuration) {
			this.workspace = workspace;
			this.context = context;
			this.canvas = canvas;
			this.gridPattern = gridPattern;
			this.gridPatternPath = gridPatternPath;
			this.foreground = foreground;
			this.configuration = configuration;
			this.onResizeHandler = () => this.onResize();
		}
		static create(context, parent, configuration) {
			const defs = Dom.svg('defs');
			const gridPatternId = 'sqd-grid-pattern-' + lastGridPatternId++;
			const gridPattern = Dom.svg('pattern', {
				id: gridPatternId,
				patternUnits: 'userSpaceOnUse'
			});
			const gridPatternPath = Dom.svg('path', {
				class: 'sqd-grid-path',
				fill: 'none'
			});
			defs.appendChild(gridPattern);
			gridPattern.appendChild(gridPatternPath);
			const foreground = Dom.svg('g');
			const workspace = Dom.element('div', {
				class: 'sqd-workspace'
			});
			const canvas = Dom.svg('svg', {
				class: 'sqd-workspace-canvas'
			});
			canvas.appendChild(defs);
			canvas.appendChild(
				Dom.svg('rect', {
					width: '100%',
					height: '100%',
					fill: `url(#${gridPatternId})`
				})
			);
			canvas.appendChild(foreground);
			workspace.appendChild(canvas);
			parent.appendChild(workspace);
			const view = new WorkspaceView(context, workspace, canvas, gridPattern, gridPatternPath, foreground, configuration);
			window.addEventListener('resize', view.onResizeHandler, false);
			return view;
		}
		// Create Start points
		render(sequence) {
			if (this.rootComponent) {
				this.rootComponent.view.destroy();
			}
			this.rootComponent = StartComponent.create(this.foreground, sequence, this.configuration);
			this.refreshSize();
		}
		setPositionAndScale(position, scale) {
			const gridSize = GRID_SIZE * scale;
			Dom.attrs(this.gridPattern, {
				x: position.x,
				y: position.y,
				width: gridSize,
				height: gridSize
			});
			Dom.attrs(this.gridPatternPath, {
				d: `M ${gridSize} 0 L 0 0 0 ${gridSize}`
			});
			Dom.attrs(this.foreground, {
				transform: `translate(${position.x}, ${position.y}) scale(${scale})`
			});
		}
		getClientPosition() {
			const rect = this.canvas.getBoundingClientRect();
			return new Vector(rect.x, rect.y);
		}
		getClientSize() {
			return new Vector(this.canvas.clientWidth, this.canvas.clientHeight);
		}
		bindMouseDown(handler) {
			this.canvas.addEventListener('mousedown', e => handler(readMousePosition(e), e.target, e.button), false);
		}
		bindTouchStart(handler) {
			this.canvas.addEventListener(
				'touchstart',
				e => {
					e.preventDefault();
					handler(readTouchPosition(e));
				},
				false
			);
		}
		bindContextMenu(handler) {
			this.canvas.addEventListener('contextmenu', handler, false);
		}
		bindWheel(handler) {
			this.canvas.addEventListener('wheel', handler, false);
		}
		destroy() {
			window.removeEventListener('resize', this.onResizeHandler, false);
		}
		refreshSize() {
			Dom.attrs(this.canvas, {
				width: this.workspace.offsetWidth,
				height: this.workspace.offsetHeight
			});
		}
		onResize() {
			this.refreshSize();
		}
	}

	const WHEEL_DELTA = 0.1;
	const ZOOM_DELTA = 0.2;
	class Workspace {
		constructor(view, context) {
			this.view = view;
			this.context = context;
			this.isValid = false;
			this.selectedStepComponent = null;
		}
		static create(parent, context) {
			const view = WorkspaceView.create(context, parent, context.configuration.steps);
			const workspace = new Workspace(view, context);
			setTimeout(() => {
				workspace.render();
				workspace.resetViewPort();
			});
			context.setProvider(workspace);
			context.onViewPortChanged.subscribe(vp => workspace.onViewPortChanged(vp));
			context.onIsDraggingChanged.subscribe(i => workspace.onIsDraggingChanged(i));
			context.onIsSmartEditorCollapsedChanged.subscribe(() => workspace.onIsSmartEditorCollapsedChanged());
			race(0, context.onDefinitionChanged, context.onSelectedStepChanged).subscribe(r => {
				const [defChangedDetails, selectedStep] = r;
				if (defChangedDetails) {
					if (defChangedDetails.rerender) {
						workspace.render();
					} else {
						workspace.revalidate();
					}
				} else if (selectedStep !== undefined) {
					workspace.onSelectedStepChanged(selectedStep);
				}
			});
			view.bindMouseDown((p, t, b) => workspace.onMouseDown(p, t, b)); // step 1
			view.bindTouchStart(e => workspace.onTouchStart(e));
			view.bindContextMenu(e => workspace.onContextMenu(e));
			view.bindWheel(e => workspace.onWheel(e));
			return workspace;
		}
		render() {
			this.view.render(this.context.definition.sequence);
			this.trySelectStep(this.context.selectedStep);
			this.revalidate();
		}
		getPlaceholders() {
			const result = [];
			this.getRootComponent().getPlaceholders(result);
			return result;
		}
		getSelectedStepComponent() {
			if (this.selectedStepComponent) {
				return this.selectedStepComponent;
			}
			throw new Error('Nothing selected');
		}
		getComponentByStepId(stepId) {
			const component = this.getRootComponent().findById(stepId);
			if (!component) {
				throw new Error(`Cannot find component for step id: ${stepId}`);
			}
			return component;
		}
		resetViewPort() {
			const rcv = this.getRootComponent().view;
			const clientSize = this.view.getClientSize();
			const x = Math.max(0, (clientSize.x - rcv.width) / 2);
			const y = Math.max(0, (clientSize.y - rcv.height) / 2);
			this.context.setViewPort(new Vector(x, y), 1);
		}
		zoom(direction) {
			const delta = direction ? ZOOM_DELTA : -ZOOM_DELTA;
			const scale = this.context.limitScale(this.context.viewPort.scale + delta);
			this.context.setViewPort(this.context.viewPort.position, scale);
		}
		moveViewPortToStep(stepComponent) {
			const vp = this.context.viewPort;
			const componentPosition = stepComponent.view.getClientPosition();
			const clientSize = this.view.getClientSize();
			const realPos = vp.position.divideByScalar(vp.scale).subtract(componentPosition.divideByScalar(vp.scale));
			const componentOffset = new Vector(stepComponent.view.width, stepComponent.view.height).divideByScalar(2);
			this.context.animateViewPort(realPos.add(clientSize.divideByScalar(2)).subtract(componentOffset), 1);
		}
		destroy() {
			this.view.destroy();
		}
		revalidate() {
			this.isValid = this.getRootComponent().validate();
		}
		onMouseDown(position, target, button) { // step 2
			const isPrimaryButton = button === 0;
			const isMiddleButton = button === 1;
			if (isPrimaryButton || isMiddleButton) {
				this.startBehavior(target, position, isMiddleButton);
			}
		}
		onTouchStart(position) {
			const element = document.elementFromPoint(position.x, position.y);
			if (element) {
				this.startBehavior(element, position, false);
			}
		}
		onContextMenu(e) {
			e.preventDefault();
		}
		startBehavior(target, position, forceMoveMode) {
			const clickedStep = !forceMoveMode && !this.context.isMoveModeEnabled ? this.getRootComponent().findByElement(target) : null;
			//console.log(2707, target);
			if (clickedStep) {
				console.log(2637,this)
				this.context.behaviorController.start(position, SelectStepBehavior.create(clickedStep, this.context)); // chekc this bahavior
				//console.log( 2645, clickedStep.view.g.childNodes)
				const moreid = clickedStep.view.g.childNodes[3].id.toString();
				const but = document.getElementById(moreid)
				but.onclick = function(){
					but.addEventListener("click", clickedStep.view.icon1.classList.remove("sqd-hidden"));
			 		but.addEventListener("click", clickedStep.view.icon2.classList.remove("sqd-hidden"));
			 		but.addEventListener("click", clickedStep.view.icon3.classList.remove("sqd-hidden"));
				}
				const dropdown = clickedStep.view.g.childNodes[6].id;
				const dropdownbut = document.getElementById(dropdown)
				dropdownbut.onclick = function(){
					
					const dropdownwindow = clickedStep.view.g.childNodes[7].id;
					console.log(2658, dropdownwindow)
					const showdropdownwindow = document.getElementById(dropdownwindow)
					showdropdownwindow.classList.toggle('sqd-hidden')
				}
				//console.log(2655, clickedStep.view.g.childNodes)
				
			} else {
				//console.log(2706, this.context)
				var but = document.querySelectorAll(".moreicon");
				if(but){
					but.forEach((e) =>e.classList.add("sqd-hidden"));
				}
				console.log(2663, this.view.canvas.childNodes[2].childNodes[0].childNodes[0].childNodes)
				this.view.canvas.childNodes[2].childNodes[0].childNodes[0].childNodes.forEach((child) => {if(child.childNodes[7]) {child.childNodes[7].classList.add("sqd-hidden")}});
				this.context.behaviorController.start(position, MoveViewPortBehavior.create(this.context));
				//but.addEventListener("click", clickedStep.view.icon1.classList.add("sqd-hidden"));
			}
		}
		onWheel(e) {
			const viewPort = this.context.viewPort;
			const mousePoint = new Vector(e.pageX, e.pageY).subtract(this.view.getClientPosition());
			// The real point is point on canvas with no scale.
			const mouseRealPoint = mousePoint.divideByScalar(viewPort.scale).subtract(viewPort.position.divideByScalar(viewPort.scale));
			const wheelDelta = e.deltaY > 0 ? -WHEEL_DELTA : WHEEL_DELTA;
			const newScale = this.context.limitScale(viewPort.scale + wheelDelta);
			const position = mouseRealPoint.multiplyByScalar(-newScale).add(mousePoint);
			const scale = newScale;
			this.context.setViewPort(position, scale);
		}
		onIsDraggingChanged(isDragging) {
			this.getRootComponent().setIsDragging(isDragging);
		}
		onIsSmartEditorCollapsedChanged() {
			setTimeout(() => this.view.refreshSize());
		}
		onViewPortChanged(viewPort) {
			this.view.setPositionAndScale(viewPort.position, viewPort.scale);
		}
		onSelectedStepChanged(step) {
			//console.log(2548, step) // Step 4
			this.trySelectStep(step);
		}
		trySelectStep(step) {
			// step; clicked item
			// this.selectedStepComponent; one step behind

			//var but = document.querySelectorAll(".moreicon");
			//this.selectedStepComponent
			if (this.selectedStepComponent) {
				this.selectedStepComponent.setState(StepComponentState.default);
				if(this.selectedStepComponent.view.icon1){
				this.selectedStepComponent.view.icon1.classList.add("sqd-hidden")
				this.selectedStepComponent.view.icon2.classList.add("sqd-hidden")
				this.selectedStepComponent.view.icon3.classList.add("sqd-hidden")
				}
				this.selectedStepComponent = null;
			}
			if (step) {
				this.selectedStepComponent = this.getRootComponent().findById(step.id);
				if (!this.selectedStepComponent) {
					throw new Error(`Cannot find a step component by id ${step.id}`);
				}
				this.selectedStepComponent.setState(StepComponentState.selected);
				const clickedStep = !this.context.isMoveModeEnabled ? this.getRootComponent().findByElement(this.position) : null;
				if(clickedStep) {
					this.selectedStepComponent.view.icon1.classList.remove("sqd-hidden")
					this.selectedStepComponent.view.icon2.classList.remove("sqd-hidden")
					this.selectedStepComponent.view.icon3.classList.remove("sqd-hidden")
				//	but.addEventListener("click", clickedStep);
				//	but.addEventListener("click", clickedStep.view.icon2.classList.remove("sqd-hidden"));
				//	but.addEventListener("click", clickedStep.view.icon3.classList.remove("sqd-hidden"));
				console.log(2774, this.selectedStepComponent)
				}
			}
		}
		getRootComponent() {
			if (this.view.rootComponent) {
				return this.view.rootComponent;
			}
			throw new Error('Root component not found');
		}
	}

	class DesignerView {
		constructor(root, layoutController, workspace, toolbox) {
			this.root = root;
			this.layoutController = layoutController;
			this.workspace = workspace;
			this.toolbox = toolbox;
			this.onResizeHandler = () => this.onResize();
			this.onKeyUpHandlers = [];
		}
		static create(parent, context, configuration) {
			const theme = configuration.theme || 'light';
			const root = Dom.element('div', {
				class: `sqd-designer sqd-theme-${theme}`
			});
			parent.appendChild(root);
			const workspace = Workspace.create(root, context);
			let toolbox = undefined;
			if (!configuration.toolbox.isHidden) {
				toolbox = Toolbox.create(root, context);
			}
			ControlBar.create(root, context);
			if (!configuration.editors.isHidden) {
				SmartEditor.create(root, context);
			}
			const view = new DesignerView(root, context.layoutController, workspace, toolbox);
			view.reloadLayout();
			window.addEventListener('resize', view.onResizeHandler, false);
			return view;
		}
		bindKeyUp(handler) {
			document.addEventListener('keyup', handler, false);
			this.onKeyUpHandlers.push(handler);
		}
		destroy() {
			var _a, _b;
			window.removeEventListener('resize', this.onResizeHandler, false);
			this.onKeyUpHandlers.forEach(h => document.removeEventListener('keyup', h, false));
			this.workspace.destroy();
			(_a = this.toolbox) === null || _a === void 0 ? void 0 : _a.destroy();
			(_b = this.root.parentElement) === null || _b === void 0 ? void 0 : _b.removeChild(this.root);
		}
		onResize() {
			this.reloadLayout();
		}
		reloadLayout() {
			const isMobile = this.layoutController.isMobile();
			Dom.toggleClass(this.root, !isMobile, 'sqd-layout-desktop');
			Dom.toggleClass(this.root, isMobile, 'sqd-layout-mobile');
		}
	}

	class LayoutController {
		constructor(parent) {
			this.parent = parent;
		}
		isMobile() {
			return this.parent.clientWidth < 400; // TODO
		}
	}

	function find(sequence, needle, result) {
		for (const step of sequence) {
			switch (step.componentType) {
				case ComponentType.task:
					if (step === needle) {
						return true;
					}
					break;
				case ComponentType.switch:
					{
						if (step === needle) {
							result.push(step);
							return true;
						}
						const switchStep = step;
						const branchNames = Object.keys(switchStep.branches);
						for (const branchName of branchNames) {
							const branch = switchStep.branches[branchName];
							if (branch === needle || find(branch, needle, result)) {
								result.push(branchName);
								result.push(step);
								return true;
							}
						}
					}
					break;
				case ComponentType.container:
					{
						const containerStep = step;
						if (containerStep.sequence === needle || find(containerStep.sequence, needle, result)) {
							result.push(step);
							return true;
						}
					}
					break;
				default:
					throw new Error(`Not supported type: ${step.componentType}`);
			}
		}
		return false;
	}
	class StepsTranverser {
		static getParents(definition, needle) {
			const result = [];
			find(definition.sequence, needle, result);
			result.reverse();
			return result;
		}
	}

	class Utils {}
	Utils.nextId = Uid.next;
	Utils.getParents = StepsTranverser.getParents;

	class Designer {
		constructor(view, context) {
			this.view = view;
			this.context = context;
			this.onDefinitionChanged = new SimpleEvent();
		}
		static create(parent, startDefinition, configuration) {
			const definition = ObjectCloner.deepClone(startDefinition);
			const behaviorController = new BehaviorController();
			const layoutController = new LayoutController(parent);
			const isMobile = layoutController.isMobile();
			const context = new DesignerContext(definition, behaviorController, layoutController, configuration, isMobile, true);
			const view = DesignerView.create(parent, context, configuration);
			const designer = new Designer(view, context);
			view.bindKeyUp(e => designer.onKeyUp(e));
			context.onDefinitionChanged.subscribe(() => designer.onDefinitionChanged.forward(context.definition));
			return designer;
		}
		getDefinition() {
			return this.context.definition;
		}
		isValid() {
			return this.view.workspace.isValid;
		}
		isReadonly() {
			return this.context.isReadonly;
		}
		setIsReadonly(isReadonly) {
			this.context.setIsReadonly(isReadonly);
		}
		getSelectedStepId() {
			var _a;
			return ((_a = this.context.selectedStep) === null || _a === void 0 ? void 0 : _a.id) || null;
		}
		selectStepById(stepId) {
			this.context.selectStepById(stepId);
		}
		clearSelectedStep() {
			this.context.setSelectedStep(null);
		}
		moveViewPortToStep(stepId) {
			this.context.moveViewPortToStep(stepId);
		}
		destroy() {
			this.view.destroy();
		}
		onKeyUp(e) {
			const supportedKeys = ['Backspace', 'Delete'];
			if (!supportedKeys.includes(e.key)) {
				return;
			}
			const ignoreTagNames = ['input', 'textarea'];
			if (document.activeElement && ignoreTagNames.includes(document.activeElement.tagName.toLowerCase())) {
				return;
			}
			if (!this.context.selectedStep || this.context.isReadonly || this.context.isDragging) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			this.context.tryDeleteStep(this.context.selectedStep);
		}
	}
	Designer.utils = Utils;

	return Designer;
});
