(function() {

init()

function init() {
	initReadme()
	initCanvas()
	initTools()

	function initCanvas() {
		// create a wrapper around native canvas element (with id="c")
		window.canvas = new fabric.Canvas('canvas')

		window.$canvas = $(window.canvas.upperCanvasEl)
	}

	function initTools() {
		window.$rightPane = $('#right-pane')

		// Make entire accordion headers clickable instead of just the text
		$('.panel-heading').on('click', function(e) {
			$(e.target).find('a').click()
		})

		// Make the panel images draggable items
		$('#left-pane .panel-body > img').draggable({
			containment: $('body'),
			helper: 'clone',
			scroll: false
		})

		// Make the canvas a drop target
		$('#canvas').droppable({
			drop: onDrop
		})

		// Listen for keyboard actions
		window.onkeydown = onKeyDownHandler

		// Listen for canvas selection
		window.canvas.on('object:selected', onSelect)
		window.canvas.on('selection:cleared', onDeselect)
		window.canvas.on('object:moving', onMoving)

		// Non-image tools
		$('#add-line'  ).on('click', addLine)
		$('#add-circle').on('click', addCircle)
		$('#add-text'  ).on('click', addText)
		$('#free-draw' ).on('click', freeDraw)

		$('#imgur-export').on('click', exportToImgur)

		// Info panes
		$('#text-info-zindex'       ).on('change', onTextInfoZindexChange)
		$('#text-info-value'        ).on('change', onTextInfoValueChange)
		$('[name="text-info-align"]').on('change', onTextInfoAlignChange)
		$('#text-info-font'         ).on('change', onTextInfoFontChange)
		$('#text-info-stroke-width' ).on('change', onTextInfoStrokeWidthChange)
		//$('#text-info-stroke-color' ).on('change', onTextInfoStrokeColorChange)
		//$('#text-info-fill-color'   ).on('change', onTextInfoFillColorChange)
		$('#text-info-stroke-color' ).parent().colorpicker().on('changeColor', onTextInfoStrokeColorChange)
		$('#text-info-fill-color'   ).parent().colorpicker().on('changeColor', onTextInfoFillColorChange)

		function onKeyDownHandler(e) {
			var regex = /INPUT|SELECT|TEXTAREA/i

			switch (e.keyCode) {
				case 46: // delete
					// Disregard the Delete key if we're in an input field
					if (regex.test(e.target.tagName)) {
						return
					}

					if (window.canvas.getActiveGroup()) {
						window.canvas.getActiveGroup().forEachObject(function(o) {window.canvas.remove(o)})
						window.canvas.discardActiveGroup().renderAll()
					}
					else {
						window.canvas.remove(window.canvas.getActiveObject())
					}
					break

				case 8: // backspace
					// Stop the default behavior for Backspace if we're:
					//     A) not on an input field,
					//     B) on a disabled input field, or
					//     C) on a read-only input field.
					// The default behavior is to navigate back, which is bad.
					if (!regex.test(e.target.tagName) || e.target.disabled || e.target.readOnly) {
						e.preventDefault()
					}
					break

				default:
					break
			}
		}

		function onDrop(e, ui) {
			var templateData = $(ui.draggable).data() || {}
			var canvasOffset = $('#canvas').offset()

			fabric.Image.fromURL($(ui.draggable).attr('src'), function(imageObject) {
				if (templateData.height) {
					imageObject.scaleToHeight(templateData.height)
				}
				else if (templateData.width) {
					imageObject.scaleToWidth(templateData.width)
				}

				imageObject.set('left', ui.offset.left - canvasOffset.left).set('top', ui.offset.top - canvasOffset.top)

				var instanceData = {title: $(ui.draggable).attr('title')}
				imageObject.set('instanceData', instanceData)

				window.canvas.add(imageObject).setActiveObject(imageObject)
			})
		}

		function onSelect(e) {
			var obj = e.target
			var data = obj.get('instanceData') || {}

			// Hide all info sections
			$rightPane.find('.info').hide()

			// Show just the info section applicable to this object
			switch (obj.type) {
				case 'path':
					var $pathInfo = $rightPane.find('.path.info')

					$pathInfo.show()
					break

				case 'text':
					var $textInfo = $rightPane.find('.text.info')
					$textInfo.data('obj', obj)

					$textInfo.find('#text-info-zindex').val(obj.zIndex)
					$textInfo.find('#text-info-value').val(obj.text)
					$textInfo.find('[name="text-info-align"]').parent().removeClass('active').find('[value="'+obj.textAlign+'"]').prop('checked', true).parent().addClass('active') // jesus
					$textInfo.find('#text-info-font' ).val(obj.fontFamily)
					$textInfo.find('#text-info-stroke-width').val(obj.strokeWidth)
					$textInfo.find('#text-info-stroke-color').val(obj.stroke)
					$textInfo.find('#text-info-stroke-color').parent().colorpicker('setValue', obj.stroke)
					$textInfo.find('#text-info-fill-color'  ).val(obj.fill)
					$textInfo.find('#text-info-fill-color'  ).parent().colorpicker('setValue', obj.fill)

					$textInfo.show()
					break

				case 'image':
					var $imageInfo = $rightPane.find('.image.info')

					$imageInfo.find('.title').text(data.title || 'Image')

					$imageInfo.show()
					break

				default:
					break
			}
		}

		function onDeselect(e) {
			$rightPane.find('.info').hide()
			$rightPane.find('.general.info').show()
		}

		function onMoving(data) {
			if (data.target.rightLine) {
				data.target.rightLine.set('x1', data.target.left + data.target.radius)
				data.target.rightLine.set('y1', data.target.top  + data.target.radius)
				data.target.rightLine.set('left', Math.min(data.target.rightLine.x1, data.target.rightLine.x2))
				data.target.rightLine.set('top',  Math.min(data.target.rightLine.y1, data.target.rightLine.y2))
			}

			if (data.target.leftLine) {
				data.target.leftLine.set('x2', data.target.left + data.target.radius)
				data.target.leftLine.set('y2', data.target.top  + data.target.radius)
				data.target.leftLine.set('left', Math.min(data.target.leftLine.x1, data.target.leftLine.x2))
				data.target.leftLine.set('top',  Math.min(data.target.leftLine.y1, data.target.leftLine.y2))
			}
		}

		function addLine() {
			var polyline = null
			var points = []
			var lastPoint = null
			var linesAndPoints = []

			$('#add-line').addClass('btn-danger disabled').text('Right click to end')

			$canvas.on('click', addPoint)
			$canvas.on('contextmenu', finishLine)

			function addPoint(e, a, b) {
				var coords = {x: e.offsetX, y: e.offsetY}
				points.push(coords)
				console.log('adding point at ' + coords.x + ' ' + coords.y)

				// Create the point marker
				var radius = 10
				var point = new fabric.Circle({
					left: coords.x - radius,
					top: coords.y - radius,
					radius: radius,
					stroke: 'transparent',
					fill: 'transparent',
					strokeDashArray: [2, 6],
					strokeWidth: 2,
					hasControls: false,
					zIndex: 500
				})

				point.on('removed', onPointRemoval)
				point.on('mouseover', onPointMouseover)
				point.on('mouseout', onPointMouseout)

				window.canvas.add(point)

				// If we've placed a point previously, connect them with a line
				if (lastPoint) {
					var line = new fabric.Line([
						lastPoint.getCenterPoint().x, lastPoint.getCenterPoint().y,
						point.getCenterPoint().x, point.getCenterPoint().y
					], {
						stroke: '#000000',
						left: Math.min(lastPoint.getCenterPoint().x, point.getCenterPoint().x),
						top: Math.min(lastPoint.getCenterPoint().y, point.getCenterPoint().y),
						selectable: false,
						zIndex: 500
					})

					line.on('removed', onLineRemoval)

					window.canvas.add(line)

					// Grant references to everything
					lastPoint.set('rightLine', line)
					point.set('leftLine', line)
					line.set('leftPoint', lastPoint)
					line.set('rightPoint', point)
					linesAndPoints.push(point, line)
				}

				// Yo dawg I heard you like points so I put a pointer to your
				// point so you can point to the point
				lastPoint = point

				console.log(points)

				function onPointRemoval() {
					// If we have a right line and a left line, connect their endpoints
					if (this.rightLine && this.leftLine) {
						var rightPoint = this.rightLine.rightPoint
						var leftPoint = this.leftLine.leftPoint

						// Attach the left line to the right point
						this.leftLine.rightPoint = this.rightLine.rightPoint
						this.leftLine.set('x2', this.leftLine.rightPoint.left + this.leftLine.rightPoint.radius)
						this.leftLine.set('y2', this.leftLine.rightPoint.top  + this.leftLine.rightPoint.radius)

						// Update the left line's position
						this.leftLine.set('left', Math.min(this.leftLine.x1, this.leftLine.x2))
						this.leftLine.set('top',  Math.min(this.leftLine.y1, this.leftLine.y2))

						// Grant the right point a reference to the left line
						this.rightLine.rightPoint.leftLine = this.leftLine

						// Remove the right line entirely
						this.rightLine.set('skipRemovalLogic', true)
						window.canvas.remove(this.rightLine)
					}
					// Otherwise just remove any attached lines (and destroy references to them)
					else if (this.leftLine) {
						if (this.leftLine.leftPoint) {
							delete this.leftLine.leftPoint.rightLine
						}

						window.canvas.remove(this.leftLine)
					}
					else if (this.rightLine) {
						if (this.rightLine.rightPoint) {
							delete this.rightLine.rightPoint.leftLine
						}

						window.canvas.remove(this.rightLine)
					}
				}

				function onLineRemoval() {
					if (this.skipRemovalLogic) {return}

					// Remove any orphaned points
					if (this.leftPoint && !this.leftPoint.leftLine) {
						window.canvas.remove(this.leftPoint)
					}

					if (this.rightPoint && !this.rightPoint.rightLine) {
						window.canvas.remove(this.rightPoint)
					}
				}

				function onPointMouseover() {
					this.set('stroke', 'gray')
					canvas.renderAll()
				}

				function onPointMouseout() {
					this.set('stroke', 'transparent')
					canvas.renderAll()
				}
			}

			function finishLine() {
				$canvas.off('click', addPoint)
				$canvas.off('contextmenu', finishLine)

				$('#add-line').removeClass('btn-danger disabled').text('Add line')
				//window.canvas.setActiveGroup(linesAndPoints)

				return false
			}
		}

		function addCircle() {
			// TBD
		}

		function freeDraw() {
			window.canvas.isDrawingMode = true
			window.canvas.freeDrawingMode = 'Pencil'

			$('#free-draw').addClass('btn-danger disabled').text('Right click to end')

			$canvas.on('contextmenu', endFreeDraw)

			function endFreeDraw() {
				window.canvas.isDrawingMode = false
				$canvas.off('contextmenu', endFreeDraw)
				$('#free-draw').removeClass('btn-danger disabled').text('Free draw')

				var objs = canvas.getObjects()
				var obj = objs[objs.length - 1]
				obj.set('zIndex', 500)
				canvas.setActiveObject(obj)

				return false
			}
		}

		function addText() {
			var textStr = 'foo' || window.prompt()

			$('#add-text').addClass('btn-danger disabled').text('Right click to cancel')

			$canvas.on('click', addTextObject)
			$canvas.on('contextmenu', endAddText)

			function addTextObject(e) {
				var textStr = window.prompt()
				if (!textStr) {return}

				var text = new fabric.Text(textStr, {
					originX: 'left',
					left: e.offsetX,
					top: e.offsetY,
					fontFamily: 'helvetica',
					fontWeight: '',
					stroke: '#000000',
					fill: '#000000',
					hasRotatingPoint: true,
					centerTransform: true,
					zIndex: 500
				})

				canvas.add(text).setActiveObject(text)
				endAddText()
			}

			function endAddText() {
				$canvas.off('click', addTextObject)
				$canvas.off('contextmenu', endAddText)
				$('#add-text').removeClass('btn-danger disabled').text('Add text')
				return false
			}
		}

		function onTextInfoZindexChange() {
			$rightPane.find('.text.info').data('obj').set('zIndex', $(this).val() * 1)
			// TODO: sort canvas objects
			window.canvas.renderAll()
		}

		function onTextInfoValueChange() {
			$rightPane.find('.text.info').data('obj').set('text', $(this).val())
			window.canvas.renderAll()
		}

		function onTextInfoAlignChange() {
			$rightPane.find('.text.info').data('obj').set('textAlign', $(this).val())
			window.canvas.renderAll()
		}

		function onTextInfoFontChange() {
			$rightPane.find('.text.info').data('obj').set('fontFamily', $(this).val())
			window.canvas.renderAll()
		}

		function onTextInfoStrokeWidthChange() {
			$rightPane.find('.text.info').data('obj').set('strokeWidth', $(this).val() * 1)
			window.canvas.renderAll()
		}

		function onTextInfoStrokeColorChange(e) {
			$rightPane.find('.text.info').data('obj').set('stroke', e.value || e.color.toHex())
			window.canvas.renderAll()
		}

		function onTextInfoFillColorChange(e) {
			$rightPane.find('.text.info').data('obj').set('fill', e.value || e.color.toHex())
			window.canvas.renderAll()
		}

		function exportToImgur() {
			var imgData = canvas.toDataURL('png').replace(/.*,/, '')

			$.ajax({
				url: 'https://api.imgur.com/3/image',
				method: 'POST',
				headers: {
					Authorization: 'Client-ID 79642fcadc44981',
					Accept: 'application/json'
				},
				data: {
					image: imgData,
					type: 'base64'
				},
				success: function(result) {
					var id = result.data.id
					window.open('https://imgur.com/gallery/' + id, '_blank')
				}
			})
		}
	}

	function initReadme() {
		$.ajax({
			url: 'README.md',
			method: 'GET',
			headers: {
				Accept: 'text/plain'
			},
			success: convertMarkdown
		})

		function convertMarkdown(markdown) {
			$.ajax({
				url: 'https://api.github.com/markdown',
				method: 'POST',
				headers: {
					Accept: 'text/plain'
				},
				data: {
					text: 'Cool'
				},
				success: function(result) {
					$('#readme').html(result)
				}
			})
		}
	}
}

})();