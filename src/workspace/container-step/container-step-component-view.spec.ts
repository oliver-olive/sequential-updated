import { Dom } from '../../core/dom';
import { ComponentType, ContainerStep } from '../../definition';
import { ContainerStepComponentView } from './container-step-component-view';

describe('ContainerStepComponentView', () => {
	it('creates view', () => {
		const step: ContainerStep = {
			id: '0x0',
			componentType: ComponentType.container,
			name: 'Foo',
			properties: {},
			sequence: [],
			type: 'foo'
		};

		const parent = Dom.svg('svg');
		const view = ContainerStepComponentView.create(parent, step, {});

		expect(view).toBeDefined();
		expect(parent.children.length).not.toEqual(0);
	});
});
