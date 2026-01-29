package main

import (
	"errors"
	"time"
)

const (
	rows = 6
	cols = 7
)

type cellCoord struct {
	Row int `json:"row"`
	Col int `json:"col"`
}

type moveInfo struct {
	Row    int    `json:"row"`
	Col    int    `json:"col"`
	Symbol string `json:"symbol"`
}

func (r *Room) applyMove(payload movePayload) (statePayload, []*Player, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return statePayload{}, nil, errors.New("room is closed")
	}

	if payload.Column < 0 || payload.Column >= cols {
		return statePayload{}, nil, errors.New("invalid column")
	}

	player := r.playerByID(payload.PlayerID)
	if player == nil {
		return statePayload{}, nil, errors.New("player not found in room")
	}

	if !player.connected {
		return statePayload{}, nil, errors.New("player disconnected")
	}

	if !playerConnected(r.playerRed) || !playerConnected(r.playerYel) {
		return statePayload{}, nil, errors.New("waiting for opponent")
	}

	if r.winner != "" || r.draw {
		return statePayload{}, nil, errors.New("game already finished")
	}

	if r.turn != player.symbol {
		return statePayload{}, nil, errors.New("not your turn")
	}

	row, ok := r.dropRow(payload.Column)
	if !ok {
		return statePayload{}, nil, errors.New("column is full")
	}

	r.board[row][payload.Column] = player.symbol
	r.lastMove = &moveInfo{Row: row, Col: payload.Column, Symbol: player.symbol}

	if winner, winningCells := r.checkWinnerFrom(row, payload.Column, player.symbol); winner != "" {
		r.winner = winner
		r.winningCells = winningCells
	} else if r.checkDraw() {
		r.draw = true
	} else {
		r.turn = otherSymbol(r.turn)
	}

	state := r.snapshotLocked()
	recipients := r.connectedClientsLocked()

	return state, recipients, nil
}

func (r *Room) snapshot() statePayload {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.snapshotLocked()
}

func (r *Room) snapshotWithPlayers() (statePayload, []*Player) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.snapshotLocked(), r.connectedClientsLocked()
}

func (r *Room) snapshotLocked() statePayload {
	board := make([][]string, rows)
	for row := 0; row < rows; row++ {
		board[row] = make([]string, cols)
		copy(board[row], r.board[row][:])
	}

	status := statusWaiting
	if r.winner != "" {
		status = statusWin
	} else if r.draw {
		status = statusDraw
	} else if r.playerRed == nil || r.playerYel == nil {
		status = statusWaiting
	} else if !playerConnected(r.playerRed) || !playerConnected(r.playerYel) {
		status = statusPaused
	} else {
		status = statusInProgress
	}

	players := make(map[string]playerInfo)
	if r.playerRed != nil {
		players[symbolRed] = playerInfo{ID: r.playerRed.id, Name: r.playerRed.name, Connected: r.playerRed.connected}
	}
	if r.playerYel != nil {
		players[symbolYellow] = playerInfo{ID: r.playerYel.id, Name: r.playerYel.name, Connected: r.playerYel.connected}
	}

	payload := statePayload{
		RoomCode: r.code,
		Board:    board,
		Turn:     r.turn,
		Status:   status,
		Winner:   r.winner,
		Players:  players,
		LastMove: r.lastMove,
	}
	if len(r.winningCells) > 0 {
		payload.WinningCells = r.winningCells
	}
	return payload
}

func (r *Room) connectedClientsLocked() []*Player {
	clients := []*Player{}
	if playerConnected(r.playerRed) {
		clients = append(clients, r.playerRed)
	}
	if playerConnected(r.playerYel) {
		clients = append(clients, r.playerYel)
	}
	for _, spectator := range r.spectators {
		if playerConnected(spectator) {
			clients = append(clients, spectator)
		}
	}
	return clients
}

func (r *Room) playerByID(id string) *Player {
	if r.playerRed != nil && r.playerRed.id == id {
		return r.playerRed
	}
	if r.playerYel != nil && r.playerYel.id == id {
		return r.playerYel
	}
	return nil
}

func (r *Room) dropRow(col int) (int, bool) {
	for row := rows - 1; row >= 0; row-- {
		if r.board[row][col] == "" {
			return row, true
		}
	}
	return -1, false
}

func (r *Room) checkWinnerFrom(row, col int, symbol string) (string, []cellCoord) {
	directions := [][2]int{{0, 1}, {1, 0}, {1, 1}, {1, -1}}
	for _, dir := range directions {
		line := r.lineCells(row, col, dir[0], dir[1], symbol)
		if len(line) >= 4 {
			return symbol, line
		}
	}
	return "", nil
}

func (r *Room) lineCells(row, col, dr, dc int, symbol string) []cellCoord {
	rr, cc := row, col
	for {
		nr := rr - dr
		nc := cc - dc
		if nr < 0 || nr >= rows || nc < 0 || nc >= cols {
			break
		}
		if r.board[nr][nc] != symbol {
			break
		}
		rr, cc = nr, nc
	}

	coords := []cellCoord{}
	for {
		if rr < 0 || rr >= rows || cc < 0 || cc >= cols {
			break
		}
		if r.board[rr][cc] != symbol {
			break
		}
		coords = append(coords, cellCoord{Row: rr, Col: cc})
		rr += dr
		cc += dc
	}
	return coords
}

func (r *Room) checkDraw() bool {
	for row := 0; row < rows; row++ {
		for col := 0; col < cols; col++ {
			if r.board[row][col] == "" {
				return false
			}
		}
	}
	return true
}

func (r *Room) resetGameLocked() {
	for row := 0; row < rows; row++ {
		for col := 0; col < cols; col++ {
			r.board[row][col] = ""
		}
	}
	if r.startingSymbol == "" {
		r.startingSymbol = symbolRed
	} else {
		r.startingSymbol = otherSymbol(r.startingSymbol)
	}
	r.turn = r.startingSymbol
	r.winner = ""
	r.draw = false
	r.winningCells = nil
	r.lastMove = nil
	r.startedAt = time.Now().UTC()
}

func otherSymbol(symbol string) string {
	if symbol == symbolRed {
		return symbolYellow
	}
	return symbolRed
}
