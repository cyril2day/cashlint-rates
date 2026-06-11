import type { IconProps } from './icon-props'

export function MoonIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20" {...props}>
      <path
        d="M15.85 12.83A6.64 6.64 0 0 1 7.17 4.15a6.64 6.64 0 1 0 8.68 8.68Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}
