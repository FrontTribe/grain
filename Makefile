.PHONY: build install test vet run clean

BIN := grain
PKG := ./cmd/grain

build:
	go build -o $(BIN) $(PKG)

install:
	go install $(PKG)

test:
	go test ./...

vet:
	go vet ./...

run: build
	./$(BIN) scan

clean:
	rm -f $(BIN) grain.json
