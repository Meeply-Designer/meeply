let { measureSVGText } = require('utils/layoutUtils.js')

const
    SPACE = '\u00A0'

module.exports = ({ x, y, isInverted, children, height, width, helperClass, ...props }) => {
    if (!children) {
        return null
    }

    let availableWidth = isInverted ? height : width,
        ratio = !isInverted ? 0 : height - width,
        style = `font-size: ${props.style.fontSize}`,
        spaceWidth = measureSVGText(SPACE, helperClass, style)[0][0].width,
        content = threadLast(measureSVGText(children, helperClass, style))(
            r.map(r.reduce(
                (memo, it) => {
                    let last = r.last(memo),
                        takenWidth = r.sum(last.map(r.prop('width'))) + last.length * spaceWidth

                    if (it.width + takenWidth < availableWidth || (it.width > availableWidth && last.length === 0)) {
                        return r.init(memo).concat([last.concat(it)])
                    } else {
                        return memo.concat([[it]])
                    }
                },
                [[]]
            )),
            r.unnest,
            r.filter(r.prop('length')),
            r.addIndex(r.map)((it, idx) =>
                <tspan x={ x + width / 2 } y={ y + ratio / 2 + it[0].height * (idx + 1)} key={ idx }>
                    { it.map(r.prop('word')).join(SPACE) }
                </tspan>
            )
        )

    return <text { ...props }>{ content }</text>
}
