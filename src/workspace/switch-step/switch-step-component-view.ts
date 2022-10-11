import { Dom } from '../../core/dom';
import { Vector } from '../../core/vector';
import { SwitchStep } from '../../definition';
import { StepsConfiguration } from '../../designer-configuration';
import { JoinView } from '../common-views//join-view';
import { LabelView } from '../common-views//label-view';
import { RegionView } from '../common-views//region-view';
import { ValidationErrorView } from '../common-views//validation-error-view';
import { InputView } from '../common-views/input-view';
import { ComponentView } from '../component';
import { SequenceComponent } from '../sequence/sequence-component';

const MIN_CHILDREN_WIDTH = 50;
const PADDING_X = 20;
const PADDING_TOP = 20;
const LABEL_HEIGHT = 22;
const CONNECTION_HEIGHT = 16;

export class SwitchStepComponentView implements ComponentView {
	public static create(parent: SVGElement, step: SwitchStep, configuration: StepsConfiguration): SwitchStepComponentView {
		
		const g = Dom.svg('g', {
			class: `sqd-switch-group sqd-type-${step.type}`
		});
		parent.appendChild(g);

		const branchNames = Object.keys(step.branches);
		const sequenceComponents = branchNames.map(bn => SequenceComponent.create(g, step.branches[bn], configuration));

		const maxChildHeight = Math.max(...sequenceComponents.map(s => s.view.height));
		const containerWidths = sequenceComponents.map(s => Math.max(s.view.width, MIN_CHILDREN_WIDTH) + PADDING_X * 2);
		const containersWidth = containerWidths.reduce((p, c) => p + c, 0);
		const containerHeight = maxChildHeight + PADDING_TOP + LABEL_HEIGHT * 2 + CONNECTION_HEIGHT * 2;
		const containerOffsets: number[] = [];

		const joinXs = sequenceComponents.map(s => Math.max(s.view.joinX, MIN_CHILDREN_WIDTH / 2));

		let totalX = 0;
		for (let i = 0; i < branchNames.length; i++) {
			containerOffsets.push(totalX);
			totalX += containerWidths[i];
		}

		branchNames.forEach((branchName, i) => {
			const sequence = sequenceComponents[i];
			const offsetX = containerOffsets[i];

			LabelView.create(g, offsetX + joinXs[i] + PADDING_X, PADDING_TOP + LABEL_HEIGHT + CONNECTION_HEIGHT, branchName, 'secondary');

			const childEndY = PADDING_TOP + LABEL_HEIGHT * 2 + CONNECTION_HEIGHT + sequence.view.height;

			const fillingHeight = containerHeight - childEndY - CONNECTION_HEIGHT;
			if (fillingHeight > 0) {
				JoinView.createStraightJoin(g, new Vector(containerOffsets[i] + joinXs[i] + PADDING_X, childEndY), fillingHeight);
			}

			const sequenceX = offsetX + PADDING_X + Math.max((MIN_CHILDREN_WIDTH - sequence.view.width) / 2, 0);
			const sequenceY = PADDING_TOP + LABEL_HEIGHT * 2 + CONNECTION_HEIGHT;
			Dom.translate(sequence.view.g, sequenceX, sequenceY);
		});

		LabelView.create(g, containerWidths[0], PADDING_TOP, step.name);

		JoinView.createStraightJoin(g, new Vector(containerWidths[0], 0), PADDING_TOP);

		const iconUrl = configuration.iconUrlProvider ? configuration.iconUrlProvider(step.componentType, step.type) : null;
		const inputView = InputView.createRectInput(g, containerWidths[0], 0, iconUrl);

		JoinView.createJoins(
			g,
			new Vector(containerWidths[0], PADDING_TOP + LABEL_HEIGHT),
			containerOffsets.map((o, i) => new Vector(o + joinXs[i] + PADDING_X, PADDING_TOP + LABEL_HEIGHT + CONNECTION_HEIGHT))
		);

		// JoinView.createJoins(
		// 	g,
		// 	new Vector(containerWidths[0], containerHeight),
		// 	containerOffsets.map(
		// 		(o, i) => new Vector(o + joinXs[i] + PADDING_X, PADDING_TOP + CONNECTION_HEIGHT + LABEL_HEIGHT * 2 + maxChildHeight)
		// 	)
		// );

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

	private constructor(
		public readonly g: SVGGElement,
		public readonly width: number,
		public readonly height: number,
		public readonly joinX: number,
		public readonly sequenceComponents: SequenceComponent[],
		private readonly regionView: RegionView,
		private readonly inputView: InputView,
		private readonly validationErrorView: ValidationErrorView
	) {}

	public getClientPosition(): Vector {
		return this.regionView.getClientPosition();
	}

	public containsElement(element: Element): boolean {
		return this.g.contains(element);
	}

	public setIsDragging(isDragging: boolean) {
		this.inputView.setIsHidden(isDragging);
	}

	public setIsSelected(isSelected: boolean) {
		this.regionView.setIsSelected(isSelected);
	}

	public setIsDisabled(isDisabled: boolean) {
		Dom.toggleClass(this.g, isDisabled, 'sqd-disabled');
	}

	public setIsValid(isValid: boolean) {
		this.validationErrorView.setIsHidden(isValid);
	}
}
