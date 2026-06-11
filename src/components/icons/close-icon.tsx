import type { IconProps } from './icon-props'

export function CloseIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20" {...props}>
      <path
        d="m5.25 5.25 9.5 9.5m0-9.5-9.5 9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
