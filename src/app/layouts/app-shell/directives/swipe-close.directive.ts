import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

@Directive({
  selector: '[appSwipeClose]',
  standalone: true
})
export class SwipeCloseDirective {
  @Output() swipeClose = new EventEmitter<{ direction: SwipeDirection, distance: number } | void>();

  @Input() swipeThreshold = 70;
  @Input() swipeTimeout = 500;
  @Input() allowedDirections: SwipeDirection[] = ['left', 'up-left', 'down-left'];

  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private tracking = false;

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = Date.now();
    this.tracking = true;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    if (!this.tracking) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;
    const duration = Date.now() - this.startTime;

    if (duration > this.swipeTimeout) {
      this.tracking = false;
      return;
    }

    const distance = Math.hypot(dx, dy);

    if (distance >= this.swipeThreshold) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const direction = this.getDirectionFromAngle(angle);

      if (this.allowedDirections.length === 0 || this.allowedDirections.includes(direction)) {
        this.swipeClose.emit({ direction, distance });
      }
    }

    this.tracking = false;
  }

  @HostListener('touchcancel')
  onTouchCancel() {
    this.tracking = false;
  }

  private getDirectionFromAngle(angle: number): SwipeDirection {
    if (angle >= -22.5 && angle < 22.5) return 'right';
    if (angle >= 22.5 && angle < 67.5) return 'down-right';
    if (angle >= 67.5 && angle < 112.5) return 'down';
    if (angle >= 112.5 && angle < 157.5) return 'down-left';
    if (angle >= 157.5 || angle < -157.5) return 'left';
    if (angle >= -157.5 && angle < -112.5) return 'up-left';
    if (angle >= -112.5 && angle < -67.5) return 'up';
    if (angle >= -67.5 && angle < -22.5) return 'up-right';
    return 'left';
  }
}
