---
id: manual/gui
type: note
graph: manual
title: GUI & Desktop
description: Use the browser web service or the native desktop app.
links:
    - node: manual/graphs
    - node: manual/search
---

# GUI & Desktop

Flow provides two graphical interfaces that share the same frontend and backend: the **browser web service** and the **native desktop app**.

## Web service

Start the web service from any workspace:

```bash
flow service
```

This starts a local HTTP server on loopback and opens your default browser. By default the port is `4317`. You can change it:

```bash
flow configure --gui-port 4318
flow service
```

Stop the service:

```bash
flow service stop
```

### The three-panel layout

The web GUI is organized into three panels:

1. **Left rail** — Search box, Home link, and the graph tree.
    
2. **Middle panel** — Home by default, or the graph canvas when you select a graph.
    
3. **Right panel** — The document editor for the selected node.
    

You can drag the split bars between panels to resize them. The width ratios are saved in `.flow/config/flow.yaml`.

### Settings

Open the settings dialog from the top-right menu to:

- Export the entire workspace as a zip archive.
    
- View and de-register local workspaces.
    
- See version, license, and copyright information in the **About** section.
    

## Desktop app

The desktop app is a native window powered by Wails. It uses the exact same embedded frontend as the web service, so the look and behavior are identical.

Launch it:

```bash
flow desktop
```

Close it:

```bash
flow desktop stop
```

### Desktop vs web service

| 
<p><br></p>

 | 

Web Service

 | 

Desktop App

 |
| --- | --- | --- |
| 

Requires browser

 | 

Yes

 | 

No

 |
| 

Runs on loopback

 | 

Yes

 | 

Yes

 |
| 

Native window feel

 | 

No

 | 

Yes

 |
| 

Image drag-and-drop

 | 

Browser native

 | 

Via Wails file binding

 |

Both interfaces read and write the same `.flow/` workspace on disk, so you can switch between them freely.
