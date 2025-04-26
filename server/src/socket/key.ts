function compose(...key: Array<string | number>) {
  return [...key].filter(item => !!item).join(':')
}

export const SocketKey = {
  room: {
    user: (id: number) => compose('room', 'user', id),
  },
}
