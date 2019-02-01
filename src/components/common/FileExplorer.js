let Button = require('components/common/Button.js')

require('./file-explorer.styl')

let File = ({ name, label, children, ...rest }) =>
        <div className='file-explorer__file' { ...rest }>
            <VGroup modifiers='align-center grow'>
                <div className='file-explorer__file-face' data-group-modifiers='grow'>
                    <VGroup modifiers='justify-center grow'>
                        { children }
                    </VGroup>
                </div>
                <div className='file-explorer__file-name'>
                    { label || name }
                </div>
            </VGroup>
        </div>,
    valueEq = r.curry((eq, value) => value.props.value === eq),
    resolvePath = (path, it) =>
        path.length === 0
            ? it
            : resolvePath(r.tail(path), React.Children.toArray(r.find(valueEq(r.head(path)), it).props.children))

module.exports = switchboard.component(
    ({ signal, slot, propsProperty, isAlive }) => {
        let selected =
                kefir.combine([
                    signal(undefined,
                        slot('select'),

                        slot('unselect'), r.always(undefined),

                        propsProperty.map(r.prop('defaultValue')).skipDuplicates()
                        .filter((it) => it !== undefined)
                    ),
                    propsProperty.map(r.prop('mustSelect'))
                ])
                .toProperty()
                .filter(([selection, mustSelect]) => !mustSelect || selection !== undefined)
                .map(r.head),
            path =
                signal(
                    [],

                    slot('navigate')
                ),
            selectedComponent =
                kefir.combine([path, selected, propsProperty])
                .toProperty()
                .map(([path, value, { children }]) =>
                    r.find(
                        valueEq(value),
                        resolvePath(path, React.Children.toArray(children))
                    )
                )

        kefir.combine(
            [slot('delete')],
            [selectedComponent.map(r.path(words('props onDelete')))]
        )
        .filter(r.last)
        .onValue(([_, onDelete]) => onDelete())

        return ({
            selected,
            selectedComponent,
            path
        })
    },
    ({ wiredState: { path, selected, selectedComponent }, wire, rootName, children, hideBreadcrumbs, onChange, modifiers, preview, toolbarEnabled, canDelete }) => {
        let contents = resolvePath(path, React.Children.toArray(children))

        return <VGroup modifiers='grow margin-s'>
            { !hideBreadcrumbs &&  <div className='file-explorer__breadcrumbs'>
                { threadLast(path)(
                    r.reduce((memo, next) => {
                        let lastComponent = r.last(memo),
                            pathComponent = r.find(valueEq(next), lastComponent.children)

                        return memo.concat({
                            name: pathComponent.props.name,
                            path: lastComponent.path.concat(next),
                            children: React.Children.toArray(pathComponent.props.children)
                        })
                    }, [{ path: [], name: rootName, children: React.Children.toArray(children) }]),
                    r.intersperse({ name: '»' }),
                    r.map(({ path, name }) =>
                        path
                            ? <button
                                key={ name }
                                className='file-explorer__breadcrumb'
                                onClick={ r.pipe(r.always(path), wire('navigate')) }>
                                { name }
                            </button>
                            : <span className='file-explorer__arrow'>{ name }</span>
                    )
                ) }
            </div> }

            { toolbarEnabled &&
                <div className='file-explorer__toolbar'>
                    <HGroup>
                        <Button
                            onClick={ wire('delete') }
                            disabled={ !selectedComponent || !selectedComponent.props.onDelete }>
                            <Icon name='trash' />
                        </Button>
                    </HGroup>
                </div>
            }

            <div className={ modifiersToClass('file-explorer', modifiers) }
                 data-group-modifiers='grow'
                 onClick={ (it) => it.target === it.currentTarget && wire('unselect')() }>
                <HGroup modifiers='grow' data-group-modifiers='grow'>
                    <div className='file-explorer__items' data-group-modifiers='grow'>
                        { contents.map((it, idx) =>
                            <div key={ it.props.value } className={ modifiersToClass('file-explorer__file-wrapper', it.props.value === selected && 'selected') }
                                 onClick={ r.pipe(r.always(it.props.value), r.tap(onChange || Boolean), wire('select')) }>
                                { React.cloneElement(it, { navigateToThis: r.pipe(r.always(path.concat(it.props.value)), wire('navigate')) }) }
                            </div>
                        )}
                    </div>

                    { preview }
                </HGroup>
            </div>
        </VGroup>
    }
)

module.exports.File = File

module.exports.Folder = ({ name, label, face=<Icon name='folder' />, children, navigateToThis, ...rest }) =>
    <File name={ name } label={ label } onDoubleClick={ () => navigateToThis() } { ...rest }>
        { face }
    </File>
