import React from 'react'

function Container({ children }: React.PropsWithChildren) {
    return (
        <div className='lg:flex w-full lg:justify-between lg:gap-4'>{children}</div>
    )
}

export default Container;