type TProps = {
  chainID: number | string
  baseURI?: string
}

export function useYDaemonBaseURI(props?: TProps): { yDaemonBaseUri: string } {
  const yDaemonBaseUri = props?.baseURI || import.meta.env.VITE_YDAEMON_BASE_URI

  if (!yDaemonBaseUri) {
    throw new Error('YDAEMON_BASE_URI is not defined')
  }

  if (!props?.chainID) {
    return { yDaemonBaseUri }
  }

  return { yDaemonBaseUri: `${yDaemonBaseUri}/${props.chainID}` }
}
