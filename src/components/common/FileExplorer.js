let levenshtein = require('fast-levenshtein'),

    Button = require('components/common/Button.js'),
    Modal = require('components/common/Modal.js'),
    Input = require('components/common/Input.js')


require('./file-explorer.styl')

const FOLDED_ITEMS = 100

let File = ({ name, label, children, isEditing, onBlur, onRename, onDelete, deleteText, setProps, ...rest }) =>
    <div className='file-explorer__file' { ...rest }>
        <VGroup modifiers='align-center grow justify-space-between'>
            <div className='file-explorer__file-face'>
                <VGroup modifiers='justify-center grow'>
                    { children }
                </VGroup>
            </div>
            <div className='file-explorer__file-name'>
                { !isEditing
                    ? label || name
                    : <Input.Text
                        modifiers='align-center'
                        onBlur={ onBlur }
                        onChange={ r.pipe(r.path(words('target value')), onRename) }
                        onKeyDown={ (it) => {
                            if (it.keyCode === 13) {
                                onBlur()
                            }
                        } }
                        value={ name }
                        _ref={ (it) => {
                            if (it && document.activeElement !== it) {
                                it.focus()
                                it.setSelectionRange(0, it.value.length)
                            }
                        } }
                        /> }
            </div>
        </VGroup>
    </div>,
    valueEq = r.curry((eq, value) => value.props.value === eq),
    resolvePath = (path, it) =>
        path.length === 0
            ? it
            :
            resolvePath(
                r.tail(path),
                React.Children.toArray(r.pathOr(it, words('props children'), r.find(valueEq(r.head(path)), it)))
            ),
    parseComponentsFromTree = (it) => threadLast(it)(
        React.Children.toArray,
        r.filter(r.prop('props')),
        r.map((it) => threadLast(it)(
            r.pathOr([], words('props children')),
            parseComponentsFromTree,
            r.concat([it])
        )),
        r.unnest
    )


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
                ),

            search =
                signal(
                    '',

                    path.skipDuplicates(r.equals), r.always(''),

                    slot('search.set')
                )
                .flatMapLatest((it) =>
                    it === ''
                        ? kefir.constant('')
                        : kefir.later(700, it)
                )
                .toProperty()

        kefir.combine(
            [slot('delete.confirm')],
            [selectedComponent.map(r.path(words('props onDelete')))]
        )
        .filter(r.last)
        .onValue(([_, onDelete]) => onDelete())

        kefir.combine([
            slot('selected.items.ref')
            .filter(Boolean)
            .map((it) => it.parentNode)
            .map((it) => [it, r.pick(words('top height bottom'), it.getBoundingClientRect())])
            .skipDuplicates(r.equals),

            slot('selected.item.ref')
            .filter(Boolean)
            .map((it) => r.pick(words('top height bottom'), it.getBoundingClientRect()))
            .skipDuplicates(r.equals)
        ], [propsProperty.map(r.prop('autoScroll')).skipDuplicates()])
        .filter(r.last)
        .onValue(([[ref, c], o]) => {
            // if (o.top < c.top + ref.scrollTop || o.bottom > c.bottom + ref.scrollTop) {
                if (c.top + c.height < o.bottom) {
                    ref.scrollTop = o.bottom + ref.scrollTop - c.top - c.height
                } else if (o.top < c.top) {
                    ref.scrollTop = ref.scrollTop - (c.top - o.top)
                }
            // }

        })

        return ({
            search,
            selected,
            selectedComponent,
            isEditing: signal(
                false,

                slot('isEditing.toggle'), r.not
            ),
            isDeleting: signal(
                false,

                slot('delete.toggle'), r.not
            ),
            shownItems: signal(
                1,

                slot('moreItems.enable'), (it) => it + 1,
                kefir.merge([
                    search.skipDuplicates(),
                    path.skipDuplicates(r.equals)
                ]), r.always(1)
            ).map((it) => it * FOLDED_ITEMS),
            path
        })
    },
    ({ wiredState: { path, shownItems, isDeleting, isEditing, selected, search, selectedComponent }, wire, rootName, children, hideBreadcrumbs, onChange, modifiers, preview, toolbarEnabled, canDelete, searchEnabled, onSelectedRef, advancedSearch }) => {
        let isSearching = search.trim().length > 0,
            contents =
                !isSearching
                    ? resolvePath(path, React.Children.toArray(children))
                    : threadLast(children)(
                        parseComponentsFromTree,
                        r.filter((it) =>
                            it.props.name &&
                            it.props.name.toLowerCase().indexOf(search.toLowerCase()) > -1
                        ),
                        r.uniqBy(r.path(words('props value'))),
                        r.sortBy((it) => levenshtein.get(search, it.props.name))
                    )

        return <div className={ modifiersToClass('file-explorer', modifiers) }>
            <VGroup modifiers='grow margin-s'>
                <HGroup modifiers='grow align-center margin-s'>
                    { !hideBreadcrumbs && <div className='file-explorer__breadcrumbs' data-group-modifiers='grow'>
                        { threadLast(path)(
                            !isSearching
                                ? r.reduce((memo, next) => {
                                    let lastComponent = r.last(memo),
                                        pathComponent = r.find(valueEq(next), lastComponent.children)

                                    if (!pathComponent) {
                                        return memo
                                    }

                                    return memo.concat({
                                        name: pathComponent.props.name,
                                        path: lastComponent.path.concat(next),
                                        children: React.Children.toArray(pathComponent.props.children)
                                    })
                                }, [{ path: [], name: rootName, children: React.Children.toArray(children) }])
                                : r.always([
                                    { path: [], name: rootName, resetSearch: true },
                                    { path: [], name: 'Search...' }
                                ]),
                            r.intersperse({ name: '»' }),
                            r.map(({ path, name, resetSearch }) =>
                                path
                                    ? <button
                                        key={ name }
                                        className='file-explorer__breadcrumb'
                                        onClick={
                                            !resetSearch
                                                ? r.pipe(r.always(path), wire('navigate'))
                                                : r.pipe(r.always(''), wire('search.set'))}>
                                        { name }
                                    </button>
                                    : <span className='file-explorer__arrow'>{ name }</span>
                            )
                        ) }
                    </div> }

                    { searchEnabled &&
                        <label>
                            <HGroup modifiers='margin-s'>
                                <Icon name='zoom' modifiers='m' />
                                <VGroup modifiers='margin-none'>
                                    <Input.Text
                                        placeholder='Search'
                                        defaultValue={ search }
                                        onChange={ r.pipe(r.path(words('target value')), wire('search.set')) } />
                                    { advancedSearch && <Type modifiers='xxs'><a target='_blank' rel="noopener noreferrer" href={ advancedSearch }>Advanced search</a></Type> }
                                </VGroup>
                            </HGroup>
                        </label>
                    }
                </HGroup>

                { toolbarEnabled &&
                    <div className='file-explorer__toolbar'>
                        <HGroup modifiers='margin-xs'>
                            <Button
                                onClick={ wire('delete.toggle') }
                                disabled={ !selectedComponent || !selectedComponent.props.onDelete }>
                                <Icon name='trash' />
                            </Button>
                            <Button
                                onClick={ wire('isEditing.toggle') }
                                disabled={ !selectedComponent || !selectedComponent.props.onRename }>
                                <Icon name='rename' />
                            </Button>
                        </HGroup>
                    </div>
                }

                <div data-group-modifiers='grow'
                     ref={ wire('selected.items.ref') }
                     onClick={ (it) => it.target === it.currentTarget && wire('unselect')() }>
                    <Modal isOpen={ isDeleting } heading='Confirm delete' onClose={ wire('delete.toggle') }>
                        <VGroup>
                            <div className='file-explorer__delete-confirm'>
                                <Type modifiers='align-center'>
                                    { selectedComponent && selectedComponent.props.deleteText }
                                </Type>
                            </div>

                            <HGroup modifiers='grow justify-end align-center margin-s'>
                                <button onClick={ wire('delete.toggle') }>Cancel</button>
                                <button onClick={ r.pipe(r.tap(wire('delete.toggle')), wire('delete.confirm')) }>Delete</button>
                            </HGroup>
                        </VGroup>
                    </Modal>

                    <HGroup modifiers='grow' data-group-modifiers='grow'>
                        <div className='file-explorer__items' data-group-modifiers='grow'>
                            { r.take(shownItems, contents).map((it, idx) =>
                                <div key={ it.props.value } className={ modifiersToClass('file-explorer__file-wrapper', it.props.value === selected && 'selected') }
                                     onClick={ r.pipe(r.always(it.props.value), r.tap(onChange || Boolean), wire('select')) }
                                    ref={ it.props.value === selected && wire('selected.item.ref') }>
                                    { React.cloneElement(it, {
                                        navigateToThis: r.pipe(
                                            r.always(path.concat(it.props.value)),
                                            wire('navigate')
                                        ),
                                        isEditing: selected === it.props.value && isEditing,
                                        onBlur: wire('isEditing.toggle')
                                    }) }
                                </div>
                            )}

                            { contents.length > shownItems &&
                                <div className={ modifiersToClass('file-explorer__file-wrapper', 'more' === selected && 'selected') }
                                     onClick={ r.pipe(r.always('more'), r.tap(onChange || Boolean), wire('select')) }>
                                    <File
                                        value='more'
                                        onDoubleClick={ wire('moreItems.enable') }
                                        name={ ` Show ${ Math.min(shownItems + FOLDED_ITEMS, contents.length) } of ${ contents.length }...` }>
                                        <Icon name='more' />
                                    </File>
                                </div>
                            }
                        </div>

                        { preview }
                    </HGroup>
                </div>
            </VGroup>
        </div>
    }
)

module.exports.File = File

module.exports.Folder = ({ name, label, face=<Icon name='folder' />, children, navigateToThis, setProps, ...rest }) =>
    <File name={ name } label={ label } onDoubleClick={ () => navigateToThis() } { ...rest }>
        { face }
    </File>
