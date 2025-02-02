// @ts-strict-ignore
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'PMT.UploadDicom',
  beforeRegisterNodeDef(nodeType, nodeData) {
    Object.keys(nodeData?.input || {}).forEach((t) => {
      Object.keys(nodeData.input[t]).forEach((inputName) => {
        const input = nodeData.input[t][inputName]
        if (input?.[1]?.dicom_upload === false) {
          nodeData.input[t][inputName] = ['STRING'] // oid text input
        } else if (input?.[1]?.dicom_upload === true) {
          nodeData.input[t]['upload'] = ['DICOMUPLOAD', { widget: inputName }]
        }
      })
    })
  },
  nodeCreated(node) {
    if (node?.comfyClass !== 'input.load_dicom') {
      return
    }

    // @ts-expect-error override
    if (node.onDragOver) {
      // @ts-expect-error override
      const _onDragOver = node.onDragOver
      // @ts-expect-error Property 'onDragOver' does not exist on type 'LGraphNode'
      node.onDragOver = function (e, ...args) {
        let handled = _onDragOver?.apply(this, [e, ...args])
        if (e.dataTransfer && e.dataTransfer.items) {
          const text = [...e.dataTransfer.items].find(
            (f) => f.kind === 'string'
          )
          if (text) {
            handled = true
          }
        }
        return handled
      }
    } else {
      // @ts-expect-error Property 'onDragOver' does not exist on type 'LGraphNode'
      node.onDragOver = function (e) {
        if (e.dataTransfer && e.dataTransfer.items) {
          const text = [...e.dataTransfer.items].find(
            (f) => f.kind === 'string'
          )
          return !!text
        }
        return false
      }
    }

    // @ts-expect-error override
    if (node.onDragDrop) {
      // @ts-expect-error override
      const _onDragDrop = node.onDragDrop
      // @ts-expect-error Property 'onDragDrop' does not exist on type 'LGraphNode'
      node.onDragDrop = function (e, ...args) {
        let handled = _onDragDrop?.apply(this, [e, ...args])
        const text = e.dataTransfer.getData('text')
        if (text && text.startsWith('{')) {
          const json = JSON.parse(text)
          if (
            json &&
            json.oid &&
            json.$typeName?.split('.').pop() === 'Instance'
          ) {
            const oidWidget = node.widgets.find((w) => {
              return w.name === 'oid'
            })
            if (oidWidget) {
              oidWidget.value = json.oid
            }
            handled = true
          }
        }
        return handled
      }
    } else {
      // @ts-expect-error Property 'onDragDrop' does not exist on type 'LGraphNode'
      node.onDragDrop = function (e) {
        let handled = false
        const text = e.dataTransfer.getData('text')
        if (text && text.startsWith('{')) {
          const json = JSON.parse(text)
          if (
            json &&
            json.oid &&
            json.$typeName?.split('.').pop() === 'Instance'
          ) {
            const oidWidget = node.widgets.find((w) => {
              return w.name === 'oid'
            })
            if (oidWidget) {
              oidWidget.value = json.oid
            }
            handled = true
          }
        }
        return handled
      }
    }

    // ...
  },
  getCustomWidgets(app) {
    return {
      DICOMUPLOAD(node, inputName, inputData, app) {
        const customWidget = node.widgets.find(
          (w) => w.name === (inputData[1]?.widget ?? 'dicom')
        )
        if (customWidget) {
          const default_value = customWidget.value
          Object.defineProperty(customWidget, 'value', {
            get: function () {
              if (!this._real_value) {
                return default_value
              }
              let value = this._real_value
              if (value.filename) {
                const real_value = value
                value = ''
                value += real_value.filename
                if (real_value.type && real_value.type !== 'input')
                  value += ` [${real_value.type}]`
              }
              return value
            },
            set: function (value) {
              this._real_value = value
            }
          })

          // @ts-expect-error Property 'callback' does not exist on type 'LGraphNode'
          const cb = node.callback
          customWidget.callback = function (...args) {
            if (customWidget.value) {
              showImage(customWidget.value)
            }
            if (cb) {
              return cb.apply(this, args)
            }
          }
          requestAnimationFrame(() => {
            if (customWidget.value) {
              showImage(customWidget.value)
            }
          })
        }

        function showImage(filename) {
          // const img = new Image()
          // img.onload = () => {
          //   node.imgs = [img]
          //   app.graph.setDirtyCanvas(true)
          // }
          // img.src = `/some/path/${filename}`
          // node.setSizeForImage?.()
        }

        async function uploadFile(file, updateNode, pasted = false) {
          try {
            const formData = new FormData()
            formData.append('dicom', file)
            if (formData.get('dicom')) {
              console.log(file)
              // [POST] /upload api...
              if (customWidget) {
                customWidget.options.values = [file.name]
              }
              if (updateNode) {
                if (customWidget) {
                  customWidget.value = file.name
                }
                showImage(customWidget.value)
              }
            }
          } catch (err) {
            console.error(err)
          }
        }

        const fileInput = document.createElement('input')
        Object.assign(fileInput, {
          type: 'file',
          accept: 'application/dicom',
          hidden: true,
          onchange: async () => {
            if (fileInput.files.length) {
              const file = fileInput.files[0]
              const ext = file.name.split('.').slice(1).pop()
              if (!ext || ext === 'dcm') {
                await uploadFile(file, true)
              }
            }
          }
        })

        const uploadWidget = node.addWidget(
          'button',
          inputName,
          customWidget?.name ?? 'dicom',
          () => fileInput.click()
        )
        requestAnimationFrame(() => {
          uploadWidget.label = 'CHOOSE FILE'
          app.graph.setDirtyCanvas(true)
        })

        // @ts-expect-error Property 'onDragOver' does not exist on type 'LGraphNode'
        node.onDragOver = function (e) {
          if (e.dataTransfer && e.dataTransfer.items) {
            const dicom = [...e.dataTransfer.items].find(
              (f) => f.kind === 'file'
            )
            return !!dicom
          }
          return false
        }
        // @ts-expect-error Property 'onDragDrop' does not exist on type 'LGraphNode'
        node.onDragDrop = function (e) {
          let handled = false
          for (const file of e.dataTransfer.files) {
            const ext = file.name.split('.').slice(1).pop()
            if (file.type === 'application/dicom' || !ext || ext === 'dcm') {
              uploadFile(file, !handled)
              handled = true
            }
          }
          return handled
        }

        return { widget: uploadWidget }
      }
    }
  }
})
