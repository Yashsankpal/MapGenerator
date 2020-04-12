import * as log from 'loglevel';
import interact from 'interactjs';
import Util from '../util';
import Vector from '../Vector';
import DomainController from './domain_controller';

interface Draggable {
    getCentre: (() => Vector);
    callbackFn: ((v: Vector) => void);
}

/**
* Register multiple centre points
* Closest one to mouse click will be selected to drag
* Up to caller to actually move their centre point via callback
*/
export default class DragController {
    // How close to drag handle pointer needs to be
    private readonly MIN_DRAG_DISTANCE = 50;

    private draggables: Draggable[] = [];
    private currentlyDragging: Draggable = null;
    private disabled: boolean = false;
    private domainController = DomainController.getInstance();

    constructor(private gui: dat.GUI) {
        interact(`#${Util.CANVAS_ID}`).draggable({
            onstart: this.dragStart.bind(this),
            onmove: this.dragMove.bind(this),
            onend: this.dragEnd.bind(this),
            cursorChecker: this.getCursor.bind(this),
        });
    }

    setDragDisabled(disable: boolean): void {
        this.disabled = disable;
    }

    getCursor(action: any, interactable: any, element: any, interacting: boolean) {
        if (interacting) return 'grabbing';
        return 'grab';
    }

    dragStart(event: any): void {
        // Transform screen space to world space
        const origin = this.domainController.screenToWorld(new Vector(event.x0, event.y0));
        
        let closestDistance = Infinity;
        this.draggables.forEach(draggable => {
            const d = draggable.getCentre().distanceTo(origin);
            if (d < closestDistance) {
                closestDistance = d;
                this.currentlyDragging = draggable;
            }
        });

        // Zoom screen size to world size for consistent drag distance while zoomed in
        const scaledDragDistance = this.MIN_DRAG_DISTANCE / this.domainController.zoom;

        if (closestDistance > scaledDragDistance) {
            this.currentlyDragging = null;
        }
    }

    dragMove(event: any): void {
        const delta = new Vector(event.delta.x, event.delta.y);
        this.domainController.zoomToWorld(delta);

        if (!this.disabled && this.currentlyDragging !== null) {
            // Drag field
            this.currentlyDragging.callbackFn(delta);
        } else {
            // Move map
            this.domainController.pan(delta);
        }
    }

    dragEnd(): void {
        this.currentlyDragging = null;
        Util.updateGui(this.gui);
    }

    /**
     * @param {(() => Vector)} Gets centre point
     * @param {((v: Vector) => void)} Called on move with delta vector
     * @returns {(() => void)} Function to deregister callback
     */
    register(getCentre: (() => Vector),
             onMove: ((v: Vector) => void)): (() => void) {
        const draggable: Draggable = {
            getCentre: getCentre,
            callbackFn: onMove,
        };

        this.draggables.push(draggable);
        return ((): void => {
            const index = this.draggables.indexOf(draggable);
            if (index >= 0) {
                this.draggables.splice(index, 1);
            }
        }).bind(this);
    }
}
