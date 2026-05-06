import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[appSwipeClose]',
  standalone: true
})
export class SwipeCloseDirective {
  @Output() swipeClose = new EventEmitter<void>();

  private startX = 0;
  private startY = 0;
  private tracking = false;

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.tracking = true;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    if (!this.tracking) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.startX;
    const dy = Math.abs(touch.clientY - this.startY);

    if (Math.abs(dx) > 70 && dx < 0 && dy < 80) {
      this.swipeClose.emit();
    }

    this.tracking = false;
  }

  @HostListener('touchcancel')
  onTouchCancel() {
    this.tracking = false;
  }
}
