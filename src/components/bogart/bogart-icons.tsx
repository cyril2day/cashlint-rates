'use client'

import Image from 'next/image'
import { fromNullable, matchBoolean, matchMaybe } from '@/shared/fp'

type BogartBulldogIconProps = {
  readonly className?: string
  readonly flipped?: boolean
}

const iconClassName = (className: string | undefined, flipped: boolean): string =>
  `${matchMaybe<string, string>({
    none: () => 'bogart-button__svg',
    some: (value) => value,
  })(fromNullable(className))}${matchBoolean<string>({
    false: () => '',
    true: () => ' bogart-bulldog-icon--flipped',
  })(flipped)}`

export function BogartBulldogIcon({
  className,
  flipped = false,
}: BogartBulldogIconProps = {}) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={iconClassName(className, flipped)}
      height={640}
      priority
      sizes="58px"
      src="/bogart-bulldog.png"
      width={640}
    />
  )
}

export function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="bogart-modal__close-svg"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}
