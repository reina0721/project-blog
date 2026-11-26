import { Injector, NgZone, PLATFORM_ID, createEnvironmentInjector, provideZonelessChangeDetection } from '@angular/core';
import type { EnvironmentInjector } from '@angular/core';
import { Platform } from '@angular/cdk/platform';
import { RippleRenderer, RippleState } from '@angular/material/core';

// Only the public renderer is needed in Astro. No Angular application or
// component tree is bootstrapped. The adapter installs Material's CSS in
// the enclosing shadow root instead of invoking Angular's document loader.
const environment = createEnvironmentInjector([
  provideZonelessChangeDetection(),
  { provide: PLATFORM_ID, useValue: 'browser' },
  Platform,
], Injector.NULL as EnvironmentInjector);
const zone = environment.get(NgZone);
const platform = environment.get(Platform);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function createInk(layer: HTMLElement) {
  const renderer = new RippleRenderer({ rippleConfig: {}, rippleDisabled: false }, zone, layer, platform);
  return (x: number, y: number, held: boolean) => {
    const wave = renderer.fadeInRipple(x, y, {
      persistent: held,
      animation: reduced.matches ? { enterDuration: 0, exitDuration: 0 } : undefined,
    });
    return (cancelled: boolean) => {
      if (!cancelled && wave.state === RippleState.FADING_IN) {
        // Material finishes expansion before dismissing a transient ripple.
        wave.config.persistent = false;
      } else {
        wave.fadeOut();
      }
    };
  };
}
